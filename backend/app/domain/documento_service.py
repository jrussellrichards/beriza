import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import DocumentoNoEncontrado, EstadoDocumentoInvalido
from app.domain import reglas_service
from app.ia import clasificador, extractor
from app.infrastructure.storage import get_storage
from app.models.documento import Documento
from app.models.pilar import RequisitoDocumental


@dataclass
class ResultadoSubidaDocumento:
    documento_id: uuid.UUID
    mensaje: str


@dataclass
class ResultadoAnalisis:
    documento_id: uuid.UUID
    estado: int
    campos_extraidos: dict | None
    mensaje_brecha: str | None


def subir_documento(
    db: Session,
    requisito_id: uuid.UUID,
    mandante_id: uuid.UUID,
    empresa_id: uuid.UUID | None,
    trabajador_id: uuid.UUID | None,
    archivo_url: str,
) -> ResultadoSubidaDocumento:
    """
    Registra el documento en BD con estado=1 (Enviado) y encola
    la tarea de análisis IA en Celery. Responde inmediatamente.
    Precondición: empresa_id XOR trabajador_id debe ser no nulo.
    """
    doc = Documento(
        requisito_id=requisito_id,
        mandante_id=mandante_id,
        empresa_id=empresa_id,
        trabajador_id=trabajador_id,
        archivo_url=archivo_url,
        estado=1,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Importación local para evitar circularidad con el worker
    from app.tasks.procesar_documento import procesar_documento_task
    procesar_documento_task.delay(str(doc.id))

    return ResultadoSubidaDocumento(
        documento_id=doc.id,
        mensaje="Documento recibido, analizando...",
    )


def procesar_documento(
    db: Session,
    documento_id: uuid.UUID,
) -> ResultadoAnalisis:
    """
    Ejecutado por el worker Celery. Cambia estado a 2 (En Análisis),
    llama al pipeline IA, evalúa reglas del mandante y actualiza
    el documento a estado 3 (Observado) o 4 (Aprobado).
    """
    doc = obtener_documento(db, documento_id)
    requisito = db.get(RequisitoDocumental, doc.requisito_id)

    # Estado 2: En Análisis
    doc.estado = 2
    db.commit()

    storage = get_storage()
    pdf_bytes = storage.obtener_url_firmada(doc.archivo_url)

    imagenes = clasificador.pdf_a_imagenes(pdf_bytes.encode() if isinstance(pdf_bytes, str) else pdf_bytes)

    resultado_clasificacion = clasificador.clasificar_documento(imagenes[0], requisito.codigo)
    if not resultado_clasificacion.es_valido:
        doc.estado = 3
        doc.mensaje_brecha = (
            f"El documento no parece ser un {requisito.nombre}. "
            f"Por favor suba el documento correcto."
        )
        db.commit()
        return ResultadoAnalisis(
            documento_id=doc.id,
            estado=3,
            campos_extraidos=None,
            mensaje_brecha=doc.mensaje_brecha,
        )

    campos = extractor.extraer_campos(imagenes, requisito.codigo)
    campos_dict = campos.model_dump()

    resultado_validacion = reglas_service.validar_documento(
        db, requisito.codigo, campos_dict, doc.mandante_id
    )

    doc.estado = resultado_validacion.estado
    doc.campos_extraidos = campos_dict
    doc.mensaje_brecha = "\n".join(resultado_validacion.brechas) if resultado_validacion.brechas else None

    if resultado_validacion.aprobado:
        fecha_vigencia = campos_dict.get("fecha_vigencia_hasta") or campos_dict.get("fecha_hasta")
        if fecha_vigencia:
            from datetime import date
            try:
                doc.fecha_vigencia_hasta = date.fromisoformat(fecha_vigencia)
            except (ValueError, TypeError):
                pass

    db.commit()

    return ResultadoAnalisis(
        documento_id=doc.id,
        estado=doc.estado,
        campos_extraidos=doc.campos_extraidos,
        mensaje_brecha=doc.mensaje_brecha,
    )


def aprobar_por_excepcion(
    db: Session,
    documento_id: uuid.UUID,
    usuario_id: uuid.UUID,
    justificacion: str,
) -> None:
    """
    Permite al mandante_admin aprobar manualmente un documento observado.
    Registra quién aprobó, cuándo y con qué justificación.
    """
    doc = obtener_documento(db, documento_id)
    if doc.estado != 3:
        raise EstadoDocumentoInvalido(
            f"Solo se pueden aprobar por excepción documentos en estado Observado (3). Estado actual: {doc.estado}"
        )
    doc.estado = 4
    doc.aprobado_por_excepcion = True
    doc.justificacion_excepcion = justificacion
    doc.aprobado_por_usuario_id = usuario_id
    doc.aprobado_en = datetime.now(timezone.utc)
    db.commit()


def obtener_documento(db: Session, documento_id: uuid.UUID) -> Documento:
    """Retorna el documento o lanza DocumentoNoEncontrado."""
    doc = db.get(Documento, documento_id)
    if not doc:
        raise DocumentoNoEncontrado(f"Documento {documento_id} no encontrado.")
    return doc


def listar_documentos_por_entidad(
    db: Session,
    mandante_id: uuid.UUID,
    empresa_id: uuid.UUID | None = None,
    trabajador_id: uuid.UUID | None = None,
) -> list[Documento]:
    """
    Lista todos los documentos de una empresa o trabajador
    filtrados por mandante.
    """
    query = db.query(Documento).filter_by(mandante_id=mandante_id)
    if empresa_id:
        query = query.filter_by(empresa_id=empresa_id)
    if trabajador_id:
        query = query.filter_by(trabajador_id=trabajador_id)
    return query.order_by(Documento.created_at.desc()).all()
