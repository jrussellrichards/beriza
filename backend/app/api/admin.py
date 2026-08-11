"""
Endpoints exclusivos para berisa_admin.
Proporciona estadísticas globales, listado de mandantes con KPIs y gestión de usuarios.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.domain import usuario_service
from app.middleware.auth import require_rol
from app.models.contratista import ContratistaMandante
from app.models.expediente import Acreditacion
from app.models.mandante import Mandante
from app.models.servicio import PerfilRequisitoConfig, PerfilRequisitos
from app.models.usuario import Usuario

router = APIRouter()


@router.get("/stats")
def stats_globales(
    db: Session = Depends(get_db),
    _=Depends(require_rol(["berisa_admin"])),
):
    total_mandantes = db.query(Mandante).count()
    total_contratistas = db.query(ContratistaMandante).count()
    acreditadas = db.query(ContratistaMandante).filter_by(estado_acreditacion="ACREDITADA").count()
    docs_procesados = db.query(Acreditacion).filter(
        Acreditacion.estado.in_([3, 4]), Acreditacion.eliminado_en.is_(None)
    ).count()
    tasa = round((acreditadas / total_contratistas * 100) if total_contratistas else 0, 1)

    return {
        "total_mandantes": total_mandantes,
        "total_contratistas": total_contratistas,
        "docs_procesados": docs_procesados,
        "tasa_acreditacion": tasa,
    }


@router.get("/mandantes")
def listar_mandantes(
    db: Session = Depends(get_db),
    _=Depends(require_rol(["berisa_admin"])),
):
    mandantes = db.query(Mandante).order_by(Mandante.created_at).all()
    resultado = []
    for m in mandantes:
        rels = db.query(ContratistaMandante).filter_by(mandante_id=m.id).all()
        total = len(rels)
        acreditadas = sum(1 for r in rels if r.estado_acreditacion == "ACREDITADA")
        resultado.append({
            "id": str(m.id),
            "razon_social": m.razon_social,
            "rut": m.rut,
            "plan": m.plan,
            "activo": m.activo,
            "email_contacto": m.email_contacto,
            "sitio_web": m.sitio_web,
            "total_contratistas": total,
            "acreditadas": acreditadas,
            "pct_acreditacion": round(acreditadas / total * 100) if total else 0,
            # Cuántos requisitos exige de verdad este mandante, sumando sus
            # perfiles. El panel de BERISA mostraba "Pilares activos: 3" escrito
            # literal en el frontend para todos, incluido un mandante recién
            # creado que no ha configurado nada.
            "requisitos_exigidos": (
                db.query(PerfilRequisitoConfig)
                .join(PerfilRequisitos, PerfilRequisitos.id == PerfilRequisitoConfig.perfil_id)
                .filter(PerfilRequisitos.mandante_id == m.id,
                        PerfilRequisitoConfig.es_obligatorio.is_(True))
                .count()
            ),
            "perfiles": db.query(PerfilRequisitos).filter_by(mandante_id=m.id).count(),
            "fecha_creacion": m.created_at.strftime("%Y-%m-%d"),
        })
    return resultado


@router.get("/usuarios")
def listar_usuarios(
    db: Session = Depends(get_db),
    actor=Depends(require_rol(["berisa_admin"])),
):
    usuarios = db.query(Usuario).order_by(Usuario.created_at.desc()).all()
    ahora = datetime.now(timezone.utc)
    resultado = []
    for u in usuarios:
        # OJO: esto es la ANTIGÜEDAD de la cuenta, no un último acceso. No
        # existe registro de login en el modelo. La columna se rotula "Creado"
        # en la UI para no afirmar algo que el sistema no sabe.
        delta = ahora - u.created_at.replace(tzinfo=timezone.utc)
        if delta.days == 0:
            ultimo = f"Hoy {u.created_at.strftime('%H:%M')}"
        elif delta.days == 1:
            ultimo = "Ayer"
        else:
            ultimo = f"Hace {delta.days} días"

        mandante_nombre = None
        if u.mandante_id:
            m = db.get(Mandante, u.mandante_id)
            mandante_nombre = m.razon_social if m else None

        resultado.append({
            "id": str(u.id),
            "nombre": u.nombre,
            "email": u.email,
            "rol": u.rol,
            "activo": u.activo,
            "mandante": mandante_nombre,
            "cargo": u.cargo,
            # Invitación que nunca se activó: activo=False igual que una baja,
            # pero se resuelve reenviando el correo, no reactivando.
            "pendiente": usuario_service.nunca_activo(u),
            "es_uno_mismo": u.id == actor.id,
            "ultimo_acceso": ultimo,
        })
    return resultado


@router.get("/actividad")
def actividad_reciente(
    db: Session = Depends(get_db),
    _=Depends(require_rol(["berisa_admin"])),
):
    """Últimas 10 acreditaciones como feed de actividad cross-mandante."""
    docs = (
        db.query(Acreditacion)
        .filter(Acreditacion.eliminado_en.is_(None))
        .order_by(Acreditacion.created_at.desc())
        .limit(10)
        .all()
    )
    ahora = datetime.now(timezone.utc)
    resultado = []
    for doc in docs:
        mandante = db.get(Mandante, doc.mandante_id)
        mandante_nombre = mandante.razon_social.split(" ")[0] if mandante else "—"
        codigo = doc.expediente.requisito.codigo

        if doc.estado == 4:
            accion = f"Documento {codigo} aprobado"
            tipo = "ok"
        elif doc.estado == 3:
            accion = f"Documento {codigo} rechazado por IA"
            tipo = "warn"
        elif doc.estado == 2:
            accion = f"Documento {codigo} en análisis"
            tipo = "info"
        else:
            accion = f"Documento {codigo} enviado"
            tipo = "info"

        delta = ahora - doc.created_at.replace(tzinfo=timezone.utc)
        if delta.seconds < 3600:
            tiempo = f"Hace {delta.seconds // 60} min"
        elif delta.days == 0:
            tiempo = f"Hace {delta.seconds // 3600} hora{'s' if delta.seconds // 3600 > 1 else ''}"
        elif delta.days == 1:
            tiempo = "Ayer"
        else:
            tiempo = f"Hace {delta.days} días"

        resultado.append({
            "mandante": mandante_nombre,
            "accion": accion,
            "tiempo": tiempo,
            "tipo": tipo,
        })
    return resultado
