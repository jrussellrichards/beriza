import uuid

from sqlalchemy.orm import Session

from app.infrastructure.email import Email, get_email_cliente
from app.models.documento import Documento
from app.models.pilar import RequisitoDocumental
from app.models.usuario import Usuario


def notificar_resultado_acreditacion(
    db: Session,
    contratista_id: uuid.UUID,
    mandante_id: uuid.UUID,
) -> None:
    """
    Envía email al contratista_admin con el resultado final de acreditación:
    estado global, detalle de brechas pendientes y links directos a corrección.
    """
    from app.domain.acreditacion_service import obtener_estado_acreditacion

    resultado = obtener_estado_acreditacion(db, contratista_id, mandante_id)

    admin = (
        db.query(Usuario)
        .filter_by(contratista_id=contratista_id, rol="contratista_admin", activo=True)
        .first()
    )
    if not admin:
        return

    brechas_html = ""
    for pilar in resultado.pilares_empresa:
        if pilar.brechas:
            brechas_html += f"<h3>{pilar.pilar_nombre}</h3><ul>"
            brechas_html += "".join(f"<li>{b}</li>" for b in pilar.brechas)
            brechas_html += "</ul>"

    for t in resultado.trabajadores:
        if not t.cumple:
            brechas_html += f"<h3>Trabajador: {t.nombre}</h3><ul>"
            for p in t.pilares:
                for b in p.brechas:
                    brechas_html += f"<li>{b}</li>"
            brechas_html += "</ul>"

    estado_texto = {
        "ACREDITADA": "¡Felicitaciones! Su empresa está acreditada.",
        "EN_PROCESO": "Acreditación en proceso. Hay documentos de trabajadores pendientes.",
        "BLOQUEADA": "Acreditación bloqueada. Hay documentos corporativos rechazados.",
    }.get(resultado.estado_global, resultado.estado_global)

    cuerpo = f"""
    <h2>Resultado de Acreditación</h2>
    <p><strong>Estado:</strong> {resultado.estado_global}</p>
    <p>{estado_texto}</p>
    {brechas_html if brechas_html else "<p>No hay brechas pendientes.</p>"}
    """

    get_email_cliente().enviar(Email(
        destinatario=admin.email,
        asunto=f"Acredita — Estado de acreditación: {resultado.estado_global}",
        cuerpo_html=cuerpo,
    ))


def notificar_documento_observado(
    db: Session,
    documento_id: uuid.UUID,
) -> None:
    """
    Envía email al contratista cuando un documento específico es rechazado.
    Incluye el mensaje exacto de la brecha y el link directo al documento.
    """
    doc = db.get(Documento, documento_id)
    if not doc:
        return

    empresa_id = doc.empresa_id or (doc.trabajador.empresa_id if doc.trabajador_id else None)
    if not empresa_id:
        return

    admin = (
        db.query(Usuario)
        .filter_by(contratista_id=empresa_id, rol="contratista_admin", activo=True)
        .first()
    )
    if not admin:
        return

    requisito = db.get(RequisitoDocumental, doc.requisito_id)
    nombre_req = requisito.nombre if requisito else "Documento"

    cuerpo = f"""
    <h2>Documento Observado: {nombre_req}</h2>
    <p>Un documento fue revisado y no cumple los requisitos:</p>
    <blockquote>{doc.mensaje_brecha or "Documento no aprobado."}</blockquote>
    <p>Ingrese a Acredita para subir una versión corregida.</p>
    """

    get_email_cliente().enviar(Email(
        destinatario=admin.email,
        asunto=f"Acredita — {nombre_req} observado",
        cuerpo_html=cuerpo,
    ))


def notificar_excepcion_aprobada(
    db: Session,
    documento_id: uuid.UUID,
) -> None:
    """
    Notifica al contratista que el mandante aprobó manualmente
    un documento que estaba observado.
    """
    doc = db.get(Documento, documento_id)
    if not doc:
        return

    empresa_id = doc.empresa_id or (doc.trabajador.empresa_id if doc.trabajador_id else None)
    if not empresa_id:
        return

    admin = (
        db.query(Usuario)
        .filter_by(contratista_id=empresa_id, rol="contratista_admin", activo=True)
        .first()
    )
    if not admin:
        return

    requisito = db.get(RequisitoDocumental, doc.requisito_id)
    nombre_req = requisito.nombre if requisito else "Documento"

    cuerpo = f"""
    <h2>Documento Aprobado por Excepción: {nombre_req}</h2>
    <p>El mandante revisó manualmente su documento y lo aprobó como excepción.</p>
    <p><strong>Justificación:</strong> {doc.justificacion_excepcion or "Sin justificación registrada."}</p>
    """

    get_email_cliente().enviar(Email(
        destinatario=admin.email,
        asunto=f"Acredita — {nombre_req} aprobado por excepción",
        cuerpo_html=cuerpo,
    ))
