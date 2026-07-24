"""
Router de reutilización documental: la bandeja del contratista con las
solicitudes de acceso a sus documentos sensibles y su resolución.

Solo HTTP — la lógica vive en domain/reutilizacion_service.py.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.schemas import DefinirSensibilidadRequest, SolicitudAutorizacionResponse
from app.core.exceptions import DocumentoNoEncontrado, EstadoDocumentoInvalido
from app.domain import reutilizacion_service
from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.models.expediente import Acreditacion
from app.models.usuario import Usuario

router = APIRouter()


def _acreditacion_del_contratista(db: Session, acreditacion_id: uuid.UUID, usuario: Usuario) -> Acreditacion:
    """404 (no 403) si no es del contratista del usuario: no revelamos que existe."""
    acred = db.get(Acreditacion, acreditacion_id)
    if not acred:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    exp = acred.expediente
    empresa_id = exp.empresa_id or (exp.trabajador.empresa_id if exp.trabajador_id else None)
    if not usuario.contratista_id or empresa_id != usuario.contratista_id:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return acred


@router.patch("/expedientes/{expediente_id}/sensibilidad", status_code=status.HTTP_204_NO_CONTENT)
def definir_sensibilidad(
    expediente_id: uuid.UUID,
    body: DefinirSensibilidadRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin"])),
):
    """
    El contratista decide si este documento suyo se comparte con un mandante
    nuevo sin preguntarle. `null` vuelve al default del catálogo.

    Relajar solo se permite en documentos de empresa: los de trabajador llevan
    datos personales de un tercero.
    """
    if not usuario.contratista_id:
        raise HTTPException(status_code=400, detail="El usuario no está asociado a un contratista")
    try:
        reutilizacion_service.definir_sensibilidad(
            db, expediente_id, usuario.contratista_id, body.sensible
        )
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    except EstadoDocumentoInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/solicitudes", response_model=list[SolicitudAutorizacionResponse])
def listar_solicitudes(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin"])),
):
    """Documentos sensibles que un mandante nuevo quiere ver y esperan autorización."""
    if not usuario.contratista_id:
        raise HTTPException(status_code=400, detail="El usuario no está asociado a un contratista")

    resultado = []
    for acred in reutilizacion_service.acreditaciones_pendientes_autorizacion(db, usuario.contratista_id):
        exp = acred.expediente
        entregas = exp.entregas
        vigente = entregas[-1] if entregas else None
        resultado.append(SolicitudAutorizacionResponse(
            acreditacion_id=acred.id,
            mandante_razon_social=acred.mandante.razon_social,
            requisito_codigo=exp.requisito.codigo,
            requisito_nombre=exp.requisito.nombre,
            pilar_nombre=exp.requisito.subpilar.pilar.nombre,
            trabajador_nombre=exp.trabajador.nombre_completo if exp.trabajador else None,
            numero_version_vigente=vigente.numero_version if vigente else None,
            fecha_vigencia_hasta=vigente.fecha_vigencia_hasta if vigente else None,
            solicitado_en=acred.created_at,
        ))
    return resultado


@router.post("/solicitudes/{acreditacion_id}/autorizar", status_code=status.HTTP_204_NO_CONTENT)
def autorizar(
    acreditacion_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin"])),
):
    """Autoriza compartir el documento: queda a revisión del mandante."""
    _acreditacion_del_contratista(db, acreditacion_id, usuario)
    try:
        reutilizacion_service.autorizar_compartir(db, acreditacion_id, usuario.id)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    except EstadoDocumentoInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/solicitudes/{acreditacion_id}/rechazar", status_code=status.HTTP_204_NO_CONTENT)
def rechazar(
    acreditacion_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin"])),
):
    """Rechaza compartir. El requisito queda como brecha con ese mandante hasta
    que el contratista suba el documento explícitamente."""
    _acreditacion_del_contratista(db, acreditacion_id, usuario)
    try:
        reutilizacion_service.rechazar_compartir(db, acreditacion_id, usuario.id)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    except EstadoDocumentoInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))
