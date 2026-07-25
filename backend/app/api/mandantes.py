import logging
import uuid
import secrets
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.schemas import (
    DefinirPermisosRequest,
    InvitarMandanteRequest,
    InvitarUsuarioMandanteRequest,
    UsuarioMandanteResponse,
    ActualizarMandanteRequest,
    ConfigurarRequisitoPerfilRequest,
    CrearMandanteRequest,
    CrearPerfilRequest,
    InvitarContratistaRequest,
    MandanteResponse,
    PerfilResponse,
)
from app.core.config import settings
from app.core.exceptions import PermisoInsuficiente
from app.core.exceptions import PerfilNoEncontrado
from app.domain import permiso_service, acreditacion_service, servicio_service
from app.domain.estados import EstadoDocumento
from app.domain.reglas_service import VIGENCIA_DEFAULT_DIAS
from app.models.servicio import PerfilRequisitos, PerfilRequisitoConfig
from app.infrastructure.database import get_db
from app.infrastructure.email import Email, get_email_cliente
from app.middleware.auth import require_rol
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, AcreditacionEvento, Expediente
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.trabajador import Trabajador
from app.models.permiso import UsuarioPilarPermiso
from app.models.usuario import Usuario

logger = logging.getLogger("acredita")

router = APIRouter()

COLOR_PILAR = {"LEGAL": "blue", "HSE": "amber", "COMPLIANCE": "purple"}


@router.post("/", response_model=MandanteResponse, status_code=status.HTTP_201_CREATED)
def crear_mandante(
    body: CrearMandanteRequest,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin"])),
):
    """Crea un nuevo mandante en la plataforma. Solo berisa_admin."""
    if db.query(Mandante).filter_by(rut=body.rut).first():
        raise HTTPException(status_code=400, detail="Ya existe un mandante con ese RUT")

    mandante = Mandante(
        razon_social=body.razon_social,
        rut=body.rut,
        slug=body.slug,
        activo=True,
    )
    db.add(mandante)
    db.commit()
    db.refresh(mandante)
    return mandante


@router.patch("/{mandante_id}", response_model=MandanteResponse)
def actualizar_mandante(
    mandante_id: uuid.UUID,
    body: ActualizarMandanteRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Actualiza los datos de la organización. El mandante_admin solo la suya."""
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede editar su propio mandante")
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")

    if body.razon_social is not None:
        mandante.razon_social = body.razon_social
    if body.email_contacto is not None:
        mandante.email_contacto = body.email_contacto
    if body.sitio_web is not None:
        mandante.sitio_web = body.sitio_web
    db.commit()
    db.refresh(mandante)
    return mandante


@router.get("/{mandante_id}", response_model=MandanteResponse)
def obtener_mandante(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")
    return mandante


@router.post("/invitar", status_code=status.HTTP_201_CREATED)
def invitar_mandante(
    body: InvitarMandanteRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin"])),
):
    """
    BERISA crea un mandante y su usuario mandante_admin inactivo, y le envía el
    email de activación. Mismo flujo con el que un mandante invita a un
    contratista: el invitado define su password y completa sus datos al activar.

    Solo berisa_admin: el catálogo de mandantes es del operador de la plataforma.
    """
    if db.query(Usuario).filter_by(email=body.email).first():
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un usuario con el email {body.email}. "
                   "Si el mandante ya fue invitado, pídale que active su cuenta desde el email recibido.",
        )
    if db.query(Mandante).filter_by(rut=body.rut).first():
        raise HTTPException(status_code=400, detail=f"Ya existe un mandante con el RUT {body.rut}.")

    slug = (body.slug or _slug_de(body.razon_social)).strip().lower()
    if db.query(Mandante).filter_by(slug=slug).first():
        raise HTTPException(
            status_code=400,
            detail=f"El identificador '{slug}' ya está en uso. Indica un slug distinto.",
        )

    mandante = Mandante(
        razon_social=body.razon_social, rut=body.rut, slug=slug,
        plan=body.plan, email_contacto=body.email, activo=True,
    )
    db.add(mandante)
    db.flush()

    nuevo_usuario = Usuario(
        email=body.email, nombre=body.razon_social, password_hash="",
        rol="mandante_admin", activo=False, mandante_id=mandante.id,
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)

    link_activacion = f"{settings.FRONTEND_URL}/activar?token={nuevo_usuario.id}"
    try:
        get_email_cliente().enviar(Email(
            destinatario=body.email,
            asunto="Invitación a Acredita",
            cuerpo_html=f"""
            <h2>Bienvenido a Acredita</h2>
            <p>BERISA creó la cuenta de <strong>{body.razon_social}</strong> en Acredita,
            la plataforma con la que vas a acreditar a tus empresas contratistas.</p>
            <p>Para activarla y definir tu contraseña:</p>
            <a href="{link_activacion}">Activar cuenta</a>
            <p>Este enlace es personal e intransferible.</p>
            """,
        ))
    except Exception:
        logger.exception("No se pudo enviar el email de invitación a %s", body.email)
        # El link se devuelve solo al admin que hizo la invitacion, en su propia
        # respuesta autenticada. Nunca se loguea. Es un respaldo mientras el
        # dominio de envio no este verificado en Resend.
        return {
            "mensaje": f"Mandante creado, pero el email de invitación a {body.email} no pudo enviarse.",
            "link_activacion": link_activacion,
            "mandante_id": str(mandante.id),
        }

    return {"mensaje": f"Invitación enviada a {body.email}", "mandante_id": str(mandante.id)}


def _slug_de(razon_social: str) -> str:
    """Identificador url-safe derivado de la razón social."""
    import re
    import unicodedata
    sin_tildes = unicodedata.normalize("NFKD", razon_social).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sin_tildes.lower()).strip("-")[:50]


@router.post("/{mandante_id}/invitar-contratista", status_code=status.HTTP_201_CREATED)
def invitar_contratista(
    mandante_id: uuid.UUID,
    body: InvitarContratistaRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Crea una empresa contratista y un usuario contratista_admin inactivo.
    Envía email de invitación con un token (el usuario_id) para que active su cuenta.
    El token expira al ser usado (no hay TTL por ahora — Fase 2).
    El mandante_admin solo puede invitar a su propio mandante.
    """
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede invitar contratistas a su propio mandante")
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")

    if db.query(Usuario).filter_by(email=body.email).first():
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un usuario con el email {body.email}. "
                   "Si la empresa ya fue invitada, pídale que active su cuenta desde el email recibido.",
        )

    empresa_existente = db.query(EmpresaContratista).filter_by(rut=body.rut).first()
    if empresa_existente:
        empresa = empresa_existente
        if db.query(ContratistaMandante).filter_by(contratista_id=empresa.id, mandante_id=mandante_id).first():
            raise HTTPException(
                status_code=400,
                detail=f"{empresa.razon_social} ya está vinculada a este mandante.",
            )
    else:
        empresa = EmpresaContratista(rut=body.rut, razon_social=body.razon_social)
        db.add(empresa)
        db.flush()

    db.add(ContratistaMandante(contratista_id=empresa.id, mandante_id=mandante_id))

    nuevo_usuario = Usuario(
        email=body.email,
        nombre=body.razon_social,
        password_hash="",
        rol="contratista_admin",
        activo=False,
        contratista_id=empresa.id,
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)

    link_activacion = f"{settings.FRONTEND_URL}/activar?token={nuevo_usuario.id}"

    try:
        get_email_cliente().enviar(Email(
            destinatario=body.email,
            asunto=f"Invitación a acreditarse ante {mandante.razon_social}",
            cuerpo_html=f"""
            <h2>Bienvenido a Acredita</h2>
            <p>{mandante.razon_social} te invita a acreditarte como empresa contratista.</p>
            <p>Para activar tu cuenta, haz clic en el siguiente enlace:</p>
            <a href="{link_activacion}">Activar cuenta</a>
            <p>Este enlace es personal e intransferible.</p>
            """,
        ))
    except Exception:
        logger.exception("No se pudo enviar el email de invitación a %s", body.email)
        # El link solo se expone aca al admin que hizo la invitacion (via su
        # propia respuesta autenticada) -- nunca se loguea ni se muestra a
        # nadie mas. Es un respaldo temporal mientras el dominio de envio no
        # este verificado; una vez que lo este, este caso deja de ocurrir.
        return {
            "mensaje": f"Contratista creado, pero el email de invitación a {body.email} no pudo enviarse.",
            "link_activacion": link_activacion,
        }

    return {"mensaje": f"Invitación enviada a {body.email}"}


@router.get("/{mandante_id}/contratistas")
def listar_contratistas(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Lista todas las empresas contratistas vinculadas a este mandante con su estado global."""
    relaciones = (
        db.query(ContratistaMandante)
        .filter_by(mandante_id=mandante_id)
        .all()
    )
    return [
        {
            "contratista_id": str(r.contratista_id),
            "razon_social": r.contratista.razon_social,
            "rut": r.contratista.rut,
            "estado_acreditacion": r.estado_acreditacion,
        }
        for r in relaciones
    ]


@router.get("/{mandante_id}/dashboard")
def dashboard_mandante(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """KPIs, estado por pilar y alertas de contratistas bloqueados."""
    rels = db.query(ContratistaMandante).filter_by(mandante_id=mandante_id).all()
    total = len(rels)
    acreditadas = sum(1 for r in rels if r.estado_acreditacion == "ACREDITADA")
    en_proceso = sum(1 for r in rels if r.estado_acreditacion == "EN_PROCESO")
    bloqueadas = sum(1 for r in rels if r.estado_acreditacion == "BLOQUEADA")

    # Cumplimiento por pilar, evaluado desde los perfiles de servicios activos
    pilares = db.query(Pilar).order_by(Pilar.orden).all()
    cumplimiento_rels = [
        acreditacion_service.cumple_por_pilar(
            acreditacion_service.evaluar_relacion(db, rel.contratista_id, mandante_id)
        )
        for rel in rels
    ]
    pilar_stats = []
    for pilar in pilares:
        evaluados = [c for c in cumplimiento_rels if pilar.codigo in c]
        if not evaluados:
            continue
        ok_count = sum(1 for c in evaluados if c[pilar.codigo])
        pilar_stats.append({
            "codigo": pilar.codigo,
            "nombre": pilar.nombre,
            "color": COLOR_PILAR.get(pilar.codigo, "slate"),
            "ok": ok_count,
            "total": total,
            "cumplimiento": round(ok_count / total * 100) if total else 0,
        })

    # Alertas de contratistas bloqueados
    alertas = []
    bloq_rels = [r for r in rels if r.estado_acreditacion == "BLOQUEADA"]
    for rel in bloq_rels[:5]:
        brechas = []
        docs_obs = (
            db.query(Acreditacion)
            .join(Expediente, Acreditacion.expediente_id == Expediente.id)
            .filter(
                Expediente.empresa_id == rel.contratista_id,
                Acreditacion.mandante_id == mandante_id,
                Acreditacion.estado == 3,
                Acreditacion.eliminado_en.is_(None),
            )
            .all()
        )
        for d in docs_obs:
            brechas.append(d.mensaje_brecha or f"{d.expediente.requisito.codigo} observado")
        alertas.append({
            "contratista": rel.contratista.razon_social,
            "rut": rel.contratista.rut,
            "estado": rel.estado_acreditacion,
            "brechas": brechas,
        })

    # Actividad reciente (últimos docs del mandante)
    docs_recientes = (
        db.query(Acreditacion)
        .filter_by(mandante_id=mandante_id, eliminado_en=None)
        .order_by(Acreditacion.created_at.desc())
        .limit(5)
        .all()
    )
    ahora = datetime.now(timezone.utc)
    actividad = []
    for doc in docs_recientes:
        empresa = db.get(EmpresaContratista, doc.expediente.empresa_id) if doc.expediente.empresa_id else None
        nombre = empresa.razon_social if empresa else "—"
        codigo = doc.expediente.requisito.codigo
        if doc.estado == 4:
            accion = f"Documento {codigo} aprobado"
            tipo = "ok"
        elif doc.estado == 3:
            accion = f"Documento {codigo} rechazado"
            tipo = "warn"
        else:
            accion = f"Documento {codigo} enviado"
            tipo = "info"
        delta = ahora - doc.created_at.replace(tzinfo=timezone.utc)
        if delta.seconds < 3600 and delta.days == 0:
            tiempo = f"Hace {max(1, delta.seconds // 60)} min"
        elif delta.days == 0:
            tiempo = f"Hace {delta.seconds // 3600}h"
        elif delta.days == 1:
            tiempo = "Ayer"
        else:
            tiempo = f"Hace {delta.days} días"
        actividad.append({"empresa": nombre, "accion": accion, "tiempo": tiempo, "tipo": tipo})

    return {
        "total_contratistas": total,
        "acreditadas": acreditadas,
        "en_proceso": en_proceso,
        "bloqueadas": bloqueadas,
        "pilares": pilar_stats,
        "alertas": alertas,
        "actividad": actividad,
    }


@router.get("/{mandante_id}/contratistas-detalle")
def contratistas_detalle(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Lista completa de contratistas con pilares, documentos y trabajadores,
    evaluados contra los perfiles de sus servicios activos.
    """
    rels = db.query(ContratistaMandante).filter_by(mandante_id=mandante_id).all()
    resultado = []

    def _doc_dict(item) -> dict:
        return {
            "requisito_id": str(item.requisito_id),
            "requisito_codigo": item.requisito_codigo,
            "requisito_nombre": item.requisito_nombre,
            "entidad_tipo": item.entidad_tipo,
            "pilar_codigo": item.pilar_codigo,
            "pilar_nombre": item.pilar_nombre,
            "servicio_nombre": item.servicio_nombre,
            "estado": item.estado,
            "fecha_vigencia_hasta": item.fecha_vigencia_hasta.isoformat() if item.fecha_vigencia_hasta else None,
            "mensaje_brecha": item.mensaje_brecha,
            "documento_id": str(item.documento_id) if item.documento_id else None,
        }

    for rel in rels:
        empresa = rel.contratista
        ev = acreditacion_service.evaluar_relacion(db, rel.contratista_id, mandante_id)

        pilares_data = []
        for pilar in ev.pilares_empresa:
            docs_pilar = [
                _doc_dict(i) for i in ev.items_empresa if i.pilar_codigo == pilar.pilar_codigo
            ]
            pilares_data.append({
                "codigo": pilar.pilar_codigo,
                "nombre": pilar.pilar_nombre,
                "color": COLOR_PILAR.get(pilar.pilar_codigo, "slate"),
                "cumple": pilar.cumple,
                "documentos": docs_pilar,
            })

        cargos = {
            str(t.id): t
            for t in db.query(Trabajador).filter_by(empresa_id=empresa.id).all()
        }
        trabajadores_data = []
        for t in ev.trabajadores:
            items_t = ev.items_trabajadores.get(str(t.trabajador_id), [])
            trabajador = cargos.get(str(t.trabajador_id))
            trabajadores_data.append({
                "id": str(t.trabajador_id),
                "nombre": t.nombre,
                "rut": t.rut,
                "cargo": trabajador.cargo if trabajador else None,
                "activo": True,
                "cumple": t.cumple,
                "documentos": [_doc_dict(i) for i in items_t],
            })

        resultado.append({
            "id": str(empresa.id),
            "razon_social": empresa.razon_social,
            "rut": empresa.rut,
            "giro": empresa.giro,
            "estado_acreditacion": rel.estado_acreditacion,
            "total_trabajadores": len(trabajadores_data),
            "pilares": pilares_data,
            "trabajadores": trabajadores_data,
        })

    return resultado


@router.get("/{mandante_id}/configuracion")
def configuracion_mandante(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")

    equipo = db.query(Usuario).filter_by(mandante_id=mandante_id).all()
    equipo_data = []
    for u in equipo:
        # None = aprueba todos los pilares (mandante_admin); lista vacia = ninguno.
        pilares = permiso_service.pilares_que_aprueba(db, u)
        equipo_data.append({
            "id": str(u.id), "nombre": u.nombre, "email": u.email,
            "rol": u.rol, "activo": u.activo,
            "pilares": None if pilares is None else [p.nombre for p in pilares],
            "pilar_ids": [] if pilares is None else [str(p.id) for p in pilares],
        })

    return {
        "id": str(mandante.id),
        "razon_social": mandante.razon_social,
        "rut": mandante.rut,
        "email_contacto": mandante.email_contacto or "",
        "sitio_web": mandante.sitio_web or "",
        "plan": mandante.plan,
        "activo": mandante.activo,
        "equipo": equipo_data,
    }


@router.get("/{mandante_id}/reportes")
def reportes_mandante(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Datos agregados para la página de reportes."""
    rels = db.query(ContratistaMandante).filter_by(mandante_id=mandante_id).all()
    total = len(rels)
    acreditadas = sum(1 for r in rels if r.estado_acreditacion == "ACREDITADA")

    docs_todos = db.query(Acreditacion).filter_by(mandante_id=mandante_id, eliminado_en=None).all()
    docs_procesados = sum(1 for d in docs_todos if d.estado in (3, 4))

    pilares = db.query(Pilar).order_by(Pilar.orden).all()
    cumplimiento_rels = [
        acreditacion_service.cumple_por_pilar(
            acreditacion_service.evaluar_relacion(db, rel.contratista_id, mandante_id)
        )
        for rel in rels
    ]
    pilar_stats = []
    for pilar in pilares:
        evaluados = [c for c in cumplimiento_rels if pilar.codigo in c]
        if not evaluados:
            continue
        ok = sum(1 for c in evaluados if c[pilar.codigo])
        pilar_stats.append({
            "nombre": pilar.nombre,
            "cumplimiento": round(ok / total * 100) if total else 0,
        })

    # Evolución mensual real: aprobaciones registradas en la bitácora de
    # eventos (acreditacion_eventos) en los últimos 6 meses.
    from datetime import date

    hoy = date.today()
    MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
    aprobaciones = (
        db.query(AcreditacionEvento)
        .join(Acreditacion, AcreditacionEvento.acreditacion_id == Acreditacion.id)
        .filter(
            Acreditacion.mandante_id == mandante_id,
            AcreditacionEvento.estado_nuevo == EstadoDocumento.APROBADO,
        )
        .all()
    )
    por_mes: dict[tuple[int, int], int] = {}
    for ev in aprobaciones:
        clave = (ev.created_at.year, ev.created_at.month)
        por_mes[clave] = por_mes.get(clave, 0) + 1
    evolucion = []
    for i in range(5, -1, -1):
        año = hoy.year if hoy.month - i > 0 else hoy.year - 1
        mes_num = (hoy.month - 1 - i) % 12 + 1
        evolucion.append({
            "mes": MESES_ES[mes_num - 1],
            "aprobados": por_mes.get((año, mes_num), 0),
        })

    # Historial: últimos documentos procesados
    docs_recientes = (
        db.query(Acreditacion)
        .filter_by(mandante_id=mandante_id, eliminado_en=None)
        .filter(Acreditacion.estado.in_([3, 4]))
        .order_by(Acreditacion.created_at.desc())
        .limit(10)
        .all()
    )
    historial = []
    for doc in docs_recientes:
        empresa = db.get(EmpresaContratista, doc.expediente.empresa_id) if doc.expediente.empresa_id else None
        req = doc.expediente.requisito
        historial.append({
            "contratista": empresa.razon_social if empresa else "—",
            "tipo": "Documento aprobado" if doc.estado == 4 else "Documento observado",
            "descripcion": f"{req.codigo}: {req.nombre[:40]}",
            "estado": "ok" if doc.estado == 4 else "warn",
            "fecha": doc.created_at.strftime("%d/%m/%Y"),
        })

    contratistas_lista = [
        {"id": str(r.contratista_id), "nombre": r.contratista.razon_social}
        for r in rels
    ]

    return {
        "cumplimiento_global": round(acreditadas / total * 100) if total else 0,
        "total_contratistas": total,
        "acreditadas": acreditadas,
        "docs_procesados": docs_procesados,
        "pilares": pilar_stats,
        "evolucion": evolucion,
        "historial": historial,
        "contratistas_lista": contratistas_lista,
    }


def _perfil_por_defecto(db: Session, mandante_id: uuid.UUID) -> PerfilRequisitos:
    """El perfil "General" del mandante, o el primero activo si no existe."""
    perfil = db.query(PerfilRequisitos).filter_by(mandante_id=mandante_id, nombre="General").first()
    if not perfil:
        perfil = db.query(PerfilRequisitos).filter_by(mandante_id=mandante_id, activo=True).first()
    if not perfil:
        raise HTTPException(
            status_code=404,
            detail="El mandante no tiene perfiles de requisitos. Cree uno primero.",
        )
    return perfil


@router.get("/{mandante_id}/requisitos")
def listar_requisitos_mandante(
    mandante_id: uuid.UUID,
    perfil_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Catálogo de pilares/requisitos con la config del perfil superpuesta.
    Sin perfil_id usa el perfil "General" del mandante.
    """
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")

    perfil = db.get(PerfilRequisitos, perfil_id) if perfil_id else _perfil_por_defecto(db, mandante_id)
    if not perfil or perfil.mandante_id != mandante_id:
        raise HTTPException(status_code=404, detail="Perfil no encontrado para este mandante")

    configs = {
        str(c.requisito_documental_id): c
        for c in db.query(PerfilRequisitoConfig).filter_by(perfil_id=perfil.id).all()
    }

    pilares = db.query(Pilar).order_by(Pilar.orden).all()
    resultado = []
    for pilar in pilares:
        requisitos = []
        for sp in sorted(pilar.subpilares, key=lambda x: x.orden):
            for req in sp.requisitos:
                # Requisito propio de OTRO mandante -- nunca visible aquí.
                if req.mandante_id is not None and req.mandante_id != mandante_id:
                    continue
                cfg = configs.get(str(req.id))
                requisitos.append({
                    "id": str(req.id),
                    "codigo": req.codigo,
                    "nombre": req.nombre,
                    "descripcion": req.descripcion or "",
                    "entidad": req.entidad_tipo,
                    "alcance": req.alcance,
                    "max_archivos": req.max_archivos,
                    "es_propio": req.mandante_id is not None,
                    # Sin config en el perfil = el requisito NO se exige en él
                    "es_obligatorio": cfg.es_obligatorio if cfg else False,
                    "vigencia_max_dias": cfg.vigencia_max_dias if cfg else VIGENCIA_DEFAULT_DIAS,
                    "umbral_deuda_max": float(cfg.umbral_deuda_max) if cfg and cfg.umbral_deuda_max is not None else None,
                })
        resultado.append({
            "id": str(pilar.id),
            "codigo": pilar.codigo,
            "nombre": pilar.nombre,
            "descripcion": "",
            "color": COLOR_PILAR.get(pilar.codigo, "slate"),
            "requisitos": requisitos,
        })
    return {
        "perfil": {
            "id": str(perfil.id),
            "nombre": perfil.nombre,
            "descripcion": perfil.descripcion,
        },
        "pilares": resultado,
    }


@router.get("/{mandante_id}/perfiles", response_model=list[PerfilResponse])
def listar_perfiles(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Perfiles de requisitos del mandante (plantillas de exigencias por tipo de servicio)."""
    return servicio_service.listar_perfiles(db, mandante_id)


@router.post("/{mandante_id}/perfiles", response_model=PerfilResponse, status_code=status.HTTP_201_CREATED)
def crear_perfil(
    mandante_id: uuid.UUID,
    body: CrearPerfilRequest,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    if not db.get(Mandante, mandante_id):
        raise HTTPException(status_code=404, detail="Mandante no encontrado")
    return servicio_service.crear_perfil(db, mandante_id, body.nombre, body.descripcion)


@router.post("/{mandante_id}/perfiles/{perfil_id}/requisitos", status_code=status.HTTP_201_CREATED)
def configurar_requisito_perfil(
    mandante_id: uuid.UUID,
    perfil_id: uuid.UUID,
    body: ConfigurarRequisitoPerfilRequest,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Agrega o actualiza la parametrización de un requisito dentro del perfil."""
    try:
        perfil = servicio_service.obtener_perfil(db, perfil_id)
    except PerfilNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    if perfil.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="El perfil no pertenece a este mandante")

    servicio_service.configurar_requisito_perfil(
        db,
        perfil_id=perfil_id,
        requisito_documental_id=body.requisito_documental_id,
        es_obligatorio=body.es_obligatorio,
        vigencia_max_dias=body.vigencia_max_dias,
        umbral_deuda_max=body.umbral_deuda_max,
        parametros_extra=body.parametros_extra,
    )
    return {"mensaje": "Requisito configurado en el perfil"}




# ── Usuarios del mandante y sus permisos de aprobación ────────────────────────

@router.get("/{mandante_id}/usuarios", response_model=list[UsuarioMandanteResponse])
def listar_usuarios_mandante(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """El equipo del mandante con los pilares que cada uno puede aprobar."""
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede ver los usuarios de su propio mandante")

    resultado = []
    for u in db.query(Usuario).filter_by(mandante_id=mandante_id).order_by(Usuario.nombre).all():
        pilares = permiso_service.pilares_que_aprueba(db, u)
        resultado.append(UsuarioMandanteResponse(
            id=u.id, email=u.email, nombre=u.nombre, rol=u.rol, activo=u.activo,
            pilares=None if pilares is None else [p.nombre for p in pilares],
            pilar_ids=[] if pilares is None else [p.id for p in pilares],
            aprueba_todo=bool(u.aprueba_todo), cargo=u.cargo,
        ))
    return resultado


@router.post("/{mandante_id}/invitar-usuario", status_code=status.HTTP_201_CREATED)
def invitar_usuario_mandante(
    mandante_id: uuid.UUID,
    body: InvitarUsuarioMandanteRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Invita a alguien de la organización del mandante a revisar documentos.

    Son dos decisiones independientes: si administra la cuenta (`rol`) y qué
    alcance de aprobación tiene (`aprueba_todo` o `pilar_ids`). Mismo flujo de
    activación que el resto: el invitado define su propia contraseña.
    """
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede invitar usuarios a su propio mandante")
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")
    if body.rol not in ("mandante_admin", "prevencionista"):
        raise HTTPException(
            status_code=400,
            detail="El rol debe ser mandante_admin (administra la cuenta) o prevencionista.",
        )
    if db.query(Usuario).filter_by(email=body.email).first():
        raise HTTPException(status_code=400, detail=f"Ya existe un usuario con el email {body.email}.")

    # Un mandante_admin ya aprueba todo por su rol; guardar además la marca sería
    # un segundo lugar donde dice lo mismo.
    aprueba_todo = body.aprueba_todo and body.rol not in permiso_service.ROLES_SIN_RESTRICCION

    nuevo = Usuario(
        email=body.email, nombre=body.nombre, password_hash="",
        rol=body.rol, activo=False, mandante_id=mandante_id,
        aprueba_todo=aprueba_todo, cargo=body.cargo or None,
    )
    db.add(nuevo)
    db.flush()

    # Sin filas por pilar cuando aprueba todo: una sola fuente de verdad del
    # alcance (mismo criterio que permiso_service.definir_permisos).
    if not permiso_service.aprueba_cualquier_pilar(nuevo) and body.pilar_ids:
        db.add_all([
            UsuarioPilarPermiso(usuario_id=nuevo.id, pilar_id=pid) for pid in body.pilar_ids
        ])
    db.commit()
    db.refresh(nuevo)

    link_activacion = f"{settings.FRONTEND_URL}/activar?token={nuevo.id}"
    try:
        get_email_cliente().enviar(Email(
            destinatario=body.email,
            asunto=f"Invitación a Acredita — {mandante.razon_social}",
            cuerpo_html=f"""
            <h2>Te invitaron a Acredita</h2>
            <p>{mandante.razon_social} te invitó a revisar la documentación de sus
            empresas contratistas.</p>
            <p>Para activar tu cuenta y definir tu contraseña:</p>
            <a href="{link_activacion}">Activar cuenta</a>
            <p>Este enlace es personal e intransferible.</p>
            """,
        ))
    except Exception:
        logger.exception("No se pudo enviar el email de invitación a %s", body.email)
        return {
            "mensaje": f"Usuario creado, pero el email a {body.email} no pudo enviarse.",
            "link_activacion": link_activacion,
        }

    return {"mensaje": f"Invitación enviada a {body.email}"}


@router.put("/{mandante_id}/usuarios/{usuario_id}/permisos", status_code=status.HTTP_204_NO_CONTENT)
def definir_permisos_usuario(
    mandante_id: uuid.UUID,
    usuario_id: uuid.UUID,
    body: DefinirPermisosRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Reemplaza el alcance de aprobación de este usuario."""
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede cambiar permisos de su propio mandante")
    try:
        permiso_service.definir_permisos(
            db, usuario_id, mandante_id, body.pilar_ids, aprueba_todo=body.aprueba_todo
        )
    except PermisoInsuficiente as e:
        raise HTTPException(status_code=403, detail=str(e))
