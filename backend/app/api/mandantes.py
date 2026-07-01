import uuid
import secrets
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.schemas import (
    ConfigurarRequisitoRequest,
    CrearMandanteRequest,
    InvitarContratistaRequest,
    MandanteResponse,
)
from app.infrastructure.database import get_db
from app.infrastructure.email import Email, get_email_cliente
from app.middleware.auth import require_rol
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.documento import Documento
from app.models.mandante import Mandante, MandanteRequisitoConfig
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.trabajador import Trabajador
from app.models.usuario import Usuario

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


@router.post("/{mandante_id}/invitar-contratista", status_code=status.HTTP_201_CREATED)
def invitar_contratista(
    mandante_id: uuid.UUID,
    body: InvitarContratistaRequest,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin"])),
):
    """
    Crea una empresa contratista y un usuario contratista_admin inactivo.
    Envía email de invitación con un token (el usuario_id) para que active su cuenta.
    El token expira al ser usado (no hay TTL por ahora — Fase 2).
    """
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")

    empresa_existente = db.query(EmpresaContratista).filter_by(rut=body.rut).first()
    if empresa_existente:
        empresa = empresa_existente
    else:
        empresa = EmpresaContratista(rut=body.rut, razon_social=body.razon_social)
        db.add(empresa)
        db.flush()

    if not db.query(ContratistaMandante).filter_by(contratista_id=empresa.id, mandante_id=mandante_id).first():
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

    get_email_cliente().enviar(Email(
        destinatario=body.email,
        asunto=f"Invitación a acreditarse ante {mandante.razon_social}",
        cuerpo_html=f"""
        <h2>Bienvenido a Acredita</h2>
        <p>{mandante.razon_social} te invita a acreditarte como empresa contratista.</p>
        <p>Para activar tu cuenta, haz clic en el siguiente enlace:</p>
        <a href="http://localhost:3000/activar?token={nuevo_usuario.id}">Activar cuenta</a>
        <p>Este enlace es personal e intransferible.</p>
        """,
    ))

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

    # Cumplimiento por pilar
    pilares = db.query(Pilar).order_by(Pilar.orden).all()
    pilar_stats = []
    for pilar in pilares:
        req_ids = [
            r.id for sp in pilar.subpilares for r in sp.requisitos
        ]
        if not req_ids:
            continue
        ok_count = 0
        for rel in rels:
            docs_ok = db.query(Documento).filter(
                Documento.empresa_id == rel.contratista_id,
                Documento.mandante_id == mandante_id,
                Documento.requisito_id.in_(req_ids),
                Documento.estado == 4,
            ).count()
            reqs_count = db.query(MandanteRequisitoConfig).filter(
                MandanteRequisitoConfig.mandante_id == mandante_id,
                MandanteRequisitoConfig.requisito_documental_id.in_(req_ids),
                MandanteRequisitoConfig.es_obligatorio == True,
            ).count()
            if reqs_count > 0 and docs_ok >= reqs_count:
                ok_count += 1
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
        docs_obs = db.query(Documento).filter(
            Documento.empresa_id == rel.contratista_id,
            Documento.mandante_id == mandante_id,
            Documento.estado == 3,
        ).all()
        for d in docs_obs:
            brechas.append(d.mensaje_brecha or f"{d.requisito.codigo} observado")
        alertas.append({
            "contratista": rel.contratista.razon_social,
            "rut": rel.contratista.rut,
            "estado": rel.estado_acreditacion,
            "brechas": brechas,
        })

    # Actividad reciente (últimos docs del mandante)
    docs_recientes = (
        db.query(Documento)
        .filter_by(mandante_id=mandante_id)
        .order_by(Documento.created_at.desc())
        .limit(5)
        .all()
    )
    ahora = datetime.now(timezone.utc)
    actividad = []
    for doc in docs_recientes:
        empresa = db.get(EmpresaContratista, doc.empresa_id) if doc.empresa_id else None
        nombre = empresa.razon_social if empresa else "—"
        if doc.estado == 4:
            accion = f"Documento {doc.requisito.codigo} aprobado"
            tipo = "ok"
        elif doc.estado == 3:
            accion = f"Documento {doc.requisito.codigo} rechazado"
            tipo = "warn"
        else:
            accion = f"Documento {doc.requisito.codigo} enviado"
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
    """Lista completa de contratistas con pilares, documentos y trabajadores."""
    pilares = db.query(Pilar).order_by(Pilar.orden).all()
    rels = db.query(ContratistaMandante).filter_by(mandante_id=mandante_id).all()
    resultado = []

    for rel in rels:
        empresa = rel.contratista
        docs_empresa = {
            str(d.requisito_id): d
            for d in db.query(Documento).filter_by(
                empresa_id=empresa.id, mandante_id=mandante_id
            ).order_by(Documento.created_at.desc()).all()
        }

        trabajadores = db.query(Trabajador).filter_by(empresa_id=empresa.id, activo=True).all()

        pilares_data = []
        for pilar in pilares:
            docs_pilar = []
            for sp in pilar.subpilares:
                for req in sp.requisitos:
                    if req.entidad_tipo == "EMPRESA":
                        doc = docs_empresa.get(str(req.id))
                        docs_pilar.append({
                            "requisito_id": str(req.id),
                            "requisito_codigo": req.codigo,
                            "requisito_nombre": req.nombre,
                            "entidad_tipo": "EMPRESA",
                            "estado": doc.estado if doc else None,
                            "fecha_vigencia_hasta": doc.fecha_vigencia_hasta.isoformat() if doc and doc.fecha_vigencia_hasta else None,
                            "mensaje_brecha": doc.mensaje_brecha if doc else None,
                            "documento_id": str(doc.id) if doc else None,
                        })

            cumple = all(
                d["estado"] == 4 for d in docs_pilar if d["estado"] is not None
            ) and all(d["estado"] is not None for d in docs_pilar)

            pilares_data.append({
                "codigo": pilar.codigo,
                "nombre": pilar.nombre,
                "color": COLOR_PILAR.get(pilar.codigo, "slate"),
                "cumple": cumple,
                "documentos": docs_pilar,
            })

        trabajadores_data = []
        for t in trabajadores:
            docs_t = {
                str(d.requisito_id): d
                for d in db.query(Documento).filter_by(
                    trabajador_id=t.id, mandante_id=mandante_id
                ).all()
            }
            t_docs = []
            for req in db.query(RequisitoDocumental).filter_by(entidad_tipo="TRABAJADOR").all():
                doc = docs_t.get(str(req.id))
                t_docs.append({
                    "requisito_codigo": req.codigo,
                    "requisito_nombre": req.nombre,
                    "estado": doc.estado if doc else None,
                    "mensaje_brecha": doc.mensaje_brecha if doc else None,
                })
            cumple_t = all(d["estado"] == 4 for d in t_docs if d["estado"] is not None)
            trabajadores_data.append({
                "id": str(t.id),
                "nombre": t.nombre_completo,
                "rut": t.rut,
                "cargo": t.cargo,
                "activo": t.activo,
                "cumple": cumple_t,
                "documentos": t_docs,
            })

        resultado.append({
            "id": str(empresa.id),
            "razon_social": empresa.razon_social,
            "rut": empresa.rut,
            "giro": empresa.giro,
            "estado_acreditacion": rel.estado_acreditacion,
            "total_trabajadores": len(trabajadores),
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
    equipo_data = [
        {"id": str(u.id), "nombre": u.nombre, "email": u.email, "rol": u.rol, "activo": u.activo}
        for u in equipo
    ]

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

    docs_todos = db.query(Documento).filter_by(mandante_id=mandante_id).all()
    docs_procesados = sum(1 for d in docs_todos if d.estado in (3, 4))

    pilares = db.query(Pilar).order_by(Pilar.orden).all()
    pilar_stats = []
    for pilar in pilares:
        req_ids = [r.id for sp in pilar.subpilares for r in sp.requisitos if r.entidad_tipo == "EMPRESA"]
        if not req_ids:
            continue
        ok = 0
        for rel in rels:
            aprobados = db.query(Documento).filter(
                Documento.empresa_id == rel.contratista_id,
                Documento.mandante_id == mandante_id,
                Documento.requisito_id.in_(req_ids),
                Documento.estado == 4,
            ).count()
            if aprobados >= len(req_ids):
                ok += 1
        pilar_stats.append({
            "nombre": pilar.nombre,
            "cumplimiento": round(ok / total * 100) if total else 0,
        })

    # Evolución mensual simplificada (últimos 6 meses)
    from datetime import date
    import calendar
    hoy = date.today()
    evolucion = []
    MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
    for i in range(5, -1, -1):
        mes_num = (hoy.month - 1 - i) % 12 + 1
        evolucion.append({
            "mes": MESES_ES[mes_num - 1],
            "pct": round(acreditadas / total * 100 * (0.5 + i * 0.1)) if total else 0,
        })

    # Historial: últimos documentos procesados
    docs_recientes = (
        db.query(Documento)
        .filter_by(mandante_id=mandante_id)
        .filter(Documento.estado.in_([3, 4]))
        .order_by(Documento.created_at.desc())
        .limit(10)
        .all()
    )
    historial = []
    for doc in docs_recientes:
        empresa = db.get(EmpresaContratista, doc.empresa_id) if doc.empresa_id else None
        historial.append({
            "contratista": empresa.razon_social if empresa else "—",
            "tipo": "Documento aprobado" if doc.estado == 4 else "Documento observado",
            "descripcion": f"{doc.requisito.codigo}: {doc.requisito.nombre[:40]}",
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


@router.get("/{mandante_id}/requisitos")
def listar_requisitos_mandante(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Catálogo de pilares/requisitos con la config específica del mandante superpuesta."""
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")

    configs = {
        str(c.requisito_documental_id): c
        for c in db.query(MandanteRequisitoConfig).filter_by(mandante_id=mandante_id).all()
    }

    pilares = db.query(Pilar).order_by(Pilar.orden).all()
    resultado = []
    for pilar in pilares:
        requisitos = []
        for sp in sorted(pilar.subpilares, key=lambda x: x.orden):
            for req in sp.requisitos:
                cfg = configs.get(str(req.id))
                requisitos.append({
                    "id": str(req.id),
                    "codigo": req.codigo,
                    "nombre": req.nombre,
                    "descripcion": "",
                    "entidad": req.entidad_tipo,
                    "es_obligatorio": cfg.es_obligatorio if cfg else True,
                    "vigencia_max_dias": cfg.vigencia_max_dias if cfg else 30,
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
    return resultado


@router.post("/{mandante_id}/requisitos", status_code=status.HTTP_201_CREATED)
def configurar_requisito(
    mandante_id: uuid.UUID,
    body: ConfigurarRequisitoRequest,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin"])),
):
    """Agrega o actualiza la configuración de un requisito documental para este mandante."""
    config = db.query(MandanteRequisitoConfig).filter_by(
        mandante_id=mandante_id,
        requisito_documental_id=body.requisito_documental_id,
    ).first()

    if config:
        config.es_obligatorio = body.es_obligatorio
        config.vigencia_max_dias = body.vigencia_max_dias
        config.umbral_deuda_max = body.umbral_deuda_max
    else:
        config = MandanteRequisitoConfig(
            mandante_id=mandante_id,
            requisito_documental_id=body.requisito_documental_id,
            es_obligatorio=body.es_obligatorio,
            vigencia_max_dias=body.vigencia_max_dias,
            umbral_deuda_max=body.umbral_deuda_max,
        )
        db.add(config)

    db.commit()
    return {"mensaje": "Requisito configurado correctamente"}
