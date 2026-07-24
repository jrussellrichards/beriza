"""
Router de documentos. Solo HTTP — la orquestación del expediente vive en
domain/documento_service.py y la validación de archivos en archivo_service.
"""
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.schemas import (
    ArchivoDocumentoResponse,
    DocumentoContratistaResponse,
    DocumentoEventoResponse,
    DocumentoResponse,
    DocumentoVersionResponse,
    HistorialDocumentoResponse,
    PendienteRevisionResponse,
    RevisarDocumentoRequest,
    SubidaDocumentoResponse,
    UrlDescargaResponse,
)
from app.core.exceptions import (
    ArchivoInvalido,
    DocumentoNoEncontrado,
    EntregaInvalida,
    EstadoDocumentoInvalido,
    TrabajadorNoEncontrado,
)
from app.domain import acreditacion_service, archivo_service, documento_service
from app.domain.archivo_service import ArchivoEntrada
from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.middleware.tenant import verificar_acceso_documento, verificar_puede_subir_para
from app.models.expediente import Acreditacion, Archivo, Entrega
from app.models.usuario import Usuario

router = APIRouter()


# ── Builders de respuesta (nuevo modelo → contrato API estable) ───────────────

def _version_response(entrega: Entrega, acred: Acreditacion) -> DocumentoVersionResponse:
    """Una entrega como 'versión'. estado/excepción son de la acreditación y solo
    aplican a la entrega vigente (0 = versión histórica, sin estado propio)."""
    es_vigente = acred.entrega_id == entrega.id
    return DocumentoVersionResponse(
        id=entrega.id,
        numero_version=entrega.numero_version,
        estado=acred.estado if es_vigente else 0,
        mensaje_brecha=acred.mensaje_brecha if es_vigente else None,
        fecha_vigencia_hasta=entrega.fecha_vigencia_hasta,
        aprobado_por_excepcion=acred.aprobado_por_excepcion if es_vigente else False,
        created_at=entrega.created_at,
        archivos=[ArchivoDocumentoResponse.model_validate(a) for a in entrega.archivos],
    )


def _documento_response(acred: Acreditacion) -> DocumentoResponse:
    exp = acred.expediente
    entrega = acred.entrega
    return DocumentoResponse(
        id=acred.id,
        requisito_id=exp.requisito_id,
        servicio_id=exp.servicio_id,
        estado=acred.estado,
        mensaje_brecha=acred.mensaje_brecha,
        fecha_vigencia_hasta=entrega.fecha_vigencia_hasta if entrega else None,
        created_at=acred.created_at,
        version_vigente=_version_response(entrega, acred) if entrega else None,
    )


@router.post("/", response_model=SubidaDocumentoResponse, status_code=status.HTTP_202_ACCEPTED)
async def subir_documento(
    requisito_id: uuid.UUID = Form(...),
    mandante_id: uuid.UUID = Form(...),
    empresa_id: uuid.UUID | None = Form(None),
    trabajador_id: uuid.UUID | None = Form(None),
    servicio_id: uuid.UUID | None = Form(None),
    archivos: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin", "prevencionista"])),
):
    """
    Recibe una entrega (1..N archivos según el requisito), la guarda en
    storage como versión nueva del expediente y responde inmediatamente.
    Sin LLM configurado, queda pendiente de revisión manual del mandante.
    """
    entrada = [
        ArchivoEntrada(
            contenido=await a.read(),
            nombre_original=a.filename or "documento.pdf",
            mime_type=a.content_type or "application/octet-stream",
        )
        for a in archivos
    ]
    verificar_puede_subir_para(db, usuario, mandante_id, empresa_id, trabajador_id)
    try:
        resultado = documento_service.subir_entrega(
            db=db,
            requisito_id=requisito_id,
            mandante_id=mandante_id,
            empresa_id=empresa_id,
            trabajador_id=trabajador_id,
            servicio_id=servicio_id,
            archivos=entrada,
            subido_por_usuario_id=usuario.id,
        )
    except (ArchivoInvalido, EntregaInvalida, EstadoDocumentoInvalido) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TrabajadorNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))

    return SubidaDocumentoResponse(
        documento_id=resultado.documento_id,
        version_id=resultado.version_id,
        numero_version=resultado.numero_version,
        mensaje=resultado.mensaje,
    )


@router.get("/pendientes-revision", response_model=list[PendienteRevisionResponse])
def pendientes_revision(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "prevencionista"])),
):
    """Cola de revisión manual: entregas en estado Enviado del mandante del usuario."""
    if not usuario.mandante_id:
        raise HTTPException(status_code=400, detail="El usuario no está asociado a un mandante")

    acreditaciones = documento_service.listar_pendientes_revision(db, usuario.mandante_id)
    resultado = []
    for acred in acreditaciones:
        entrega = acred.entrega
        if entrega is None:
            continue
        exp = acred.expediente
        requisito = exp.requisito
        trabajador = exp.trabajador
        empresa = exp.empresa or (trabajador.empresa if trabajador else None)
        resultado.append(PendienteRevisionResponse(
            documento_id=acred.id,
            requisito_codigo=requisito.codigo,
            requisito_nombre=requisito.nombre,
            pilar_nombre=requisito.subpilar.pilar.nombre,
            contratista_razon_social=empresa.razon_social if empresa else "—",
            trabajador_nombre=trabajador.nombre_completo if trabajador else None,
            servicio_nombre=exp.servicio.nombre if exp.servicio else None,
            numero_version=entrega.numero_version,
            subido_en=entrega.created_at,
            archivos=[ArchivoDocumentoResponse.model_validate(a) for a in entrega.archivos],
        ))
    return resultado


@router.get("/mis-documentos", response_model=list[DocumentoContratistaResponse])
def mis_documentos(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin", "prevencionista"])),
):
    """
    Vista por documento del portal del contratista: cada documento con el estado
    de TODOS los mandantes que lo exigen, no de uno solo.

    El contratista se deriva del token — nunca del path — para que un usuario no
    pueda pedir la biblioteca de otra empresa.
    """
    if not usuario.contratista_id:
        raise HTTPException(status_code=400, detail="El usuario no está asociado a un contratista")
    return acreditacion_service.vista_documental(db, usuario.contratista_id)


@router.get("/{documento_id}", response_model=DocumentoResponse)
def obtener_documento(
    documento_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """Estado actual del expediente con su versión vigente y archivos."""
    try:
        acred = documento_service.obtener_documento(db, documento_id)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    verificar_acceso_documento(db, acred, usuario)
    return _documento_response(acred)


@router.get("/{documento_id}/historial", response_model=HistorialDocumentoResponse)
def historial_documento(
    documento_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """Historial completo del expediente: todas las versiones y la bitácora de eventos."""
    try:
        acred = documento_service.obtener_documento(db, documento_id)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    verificar_acceso_documento(db, acred, usuario)
    # Versiones = entregas del expediente (uploads del contratista); bitácora =
    # eventos de ESTA acreditación (no se filtran las revisiones de otro mandante).
    return HistorialDocumentoResponse(
        documento_id=acred.id,
        versiones=[_version_response(e, acred) for e in acred.expediente.entregas],
        eventos=[DocumentoEventoResponse.model_validate(ev) for ev in acred.eventos],
    )


@router.post("/{documento_id}/revisar", status_code=status.HTTP_204_NO_CONTENT)
def revisar_documento(
    documento_id: uuid.UUID,
    body: RevisarDocumentoRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["mandante_admin", "berisa_admin"])),
):
    """
    Revisión manual del mandante sobre la entrega vigente:
    aprueba (con fecha de vigencia opcional) u observa con motivo.
    """
    try:
        doc = documento_service.obtener_documento(db, documento_id)
        if usuario.mandante_id and doc.mandante_id != usuario.mandante_id:
            raise HTTPException(status_code=403, detail="El documento no pertenece a su mandante")
        documento_service.revisar_documento(
            db, documento_id, usuario.id,
            aprobar=body.aprobar,
            mensaje_brecha=body.mensaje_brecha,
            fecha_vigencia_hasta=body.fecha_vigencia_hasta,
        )
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    except EstadoDocumentoInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{documento_id}/aprobar-excepcion", status_code=status.HTTP_204_NO_CONTENT)
def aprobar_por_excepcion(
    documento_id: uuid.UUID,
    justificacion: str = Form(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["mandante_admin"])),
):
    """
    Aprueba manualmente un documento observado. Solo mandante_admin.
    Registra quién aprobó, cuándo y con qué justificación.
    """
    try:
        acred = documento_service.obtener_documento(db, documento_id)
        if usuario.mandante_id and acred.mandante_id != usuario.mandante_id:
            raise HTTPException(status_code=403, detail="El documento no pertenece a su mandante")
        documento_service.aprobar_por_excepcion(db, documento_id, usuario.id, justificacion)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    except EstadoDocumentoInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{documento_id}/archivos/{archivo_id}/url-descarga", response_model=UrlDescargaResponse)
def url_descarga_archivo(
    documento_id: uuid.UUID,
    archivo_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """URL firmada temporal (1 hora) para un archivo específico del expediente."""
    try:
        acred = documento_service.obtener_documento(db, documento_id)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    verificar_acceso_documento(db, acred, usuario)
    archivo = db.get(Archivo, archivo_id)
    if not archivo or archivo.entrega.expediente_id != acred.expediente_id:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return UrlDescargaResponse(url=archivo_service.url_descarga(archivo.storage_key))


@router.get("/{documento_id}/url-descarga", response_model=UrlDescargaResponse)
def obtener_url_descarga(
    documento_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """
    URL firmada del primer archivo de la versión vigente (compatibilidad).
    Para expedientes multi-archivo usar /archivos/{archivo_id}/url-descarga.
    """
    try:
        acred = documento_service.obtener_documento(db, documento_id)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    verificar_acceso_documento(db, acred, usuario)

    entrega = acred.entrega
    if not entrega or not entrega.archivos:
        raise HTTPException(status_code=404, detail="El expediente no tiene archivos")
    return UrlDescargaResponse(url=archivo_service.url_descarga(entrega.archivos[0].storage_key))
