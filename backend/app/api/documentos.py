"""
Router de documentos. Solo HTTP — la orquestación del expediente vive en
domain/documento_service.py y la validación de archivos en archivo_service.
"""
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.schemas import (
    DocumentoResponse,
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
from app.domain import archivo_service, documento_service
from app.domain.archivo_service import ArchivoEntrada
from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.models.documento import ArchivoDocumento
from app.models.usuario import Usuario

router = APIRouter()


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

    docs = documento_service.listar_pendientes_revision(db, usuario.mandante_id)
    resultado = []
    for d in docs:
        version = d.version_vigente
        if version is None:
            continue
        trabajador = d.trabajador
        empresa = d.empresa or (trabajador.empresa if trabajador else None)
        resultado.append(PendienteRevisionResponse(
            documento_id=d.id,
            requisito_codigo=d.requisito.codigo,
            requisito_nombre=d.requisito.nombre,
            pilar_nombre=d.requisito.subpilar.pilar.nombre,
            contratista_razon_social=empresa.razon_social if empresa else "—",
            trabajador_nombre=trabajador.nombre_completo if trabajador else None,
            servicio_nombre=d.servicio.nombre if d.servicio else None,
            numero_version=version.numero_version,
            subido_en=version.created_at,
            archivos=version.archivos,
        ))
    return resultado


@router.get("/{documento_id}", response_model=DocumentoResponse)
def obtener_documento(
    documento_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """Estado actual del expediente con su versión vigente y archivos."""
    try:
        return documento_service.obtener_documento(db, documento_id)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")


@router.get("/{documento_id}/historial", response_model=HistorialDocumentoResponse)
def historial_documento(
    documento_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """Historial completo del expediente: todas las versiones y la bitácora de eventos."""
    try:
        doc = documento_service.obtener_documento(db, documento_id)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return HistorialDocumentoResponse(
        documento_id=doc.id,
        versiones=doc.versiones,
        eventos=doc.eventos,
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
    archivo = db.get(ArchivoDocumento, archivo_id)
    if not archivo or archivo.version.documento_id != documento_id:
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
        doc = documento_service.obtener_documento(db, documento_id)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    version = doc.version_vigente
    if not version or not version.archivos:
        raise HTTPException(status_code=404, detail="El expediente no tiene archivos")
    return UrlDescargaResponse(url=archivo_service.url_descarga(version.archivos[0].storage_key))
