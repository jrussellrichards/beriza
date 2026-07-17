"""
Orquestación del expediente documental.

Responsabilidad única: ciclo de vida de entregas (versiones), transiciones
de estado y sincronización del snapshot del expediente. La validación de
archivos vive en archivo_service; las reglas de aprobación en reglas_service;
los bytes en infrastructure/storage.
"""
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import (
    DocumentoNoEncontrado,
    EntregaInvalida,
    EstadoDocumentoInvalido,
    TrabajadorNoEncontrado,
)
from app.domain import archivo_service, reglas_service
from app.domain.archivo_service import ArchivoEntrada
from app.domain.estados import Alcance, EntidadTipo, EstadoDocumento, TipoEvento, validar_transicion
from app.ia import clasificador, extractor
from app.models.documento import ArchivoDocumento, Documento, DocumentoEvento, DocumentoVersion
from app.models.pilar import RequisitoDocumental
from app.models.servicio import Servicio
from app.models.trabajador import Trabajador


@dataclass
class ResultadoSubidaDocumento:
    documento_id: uuid.UUID
    version_id: uuid.UUID
    numero_version: int
    mensaje: str


@dataclass
class ResultadoAnalisis:
    documento_id: uuid.UUID
    estado: int
    campos_extraidos: dict | None
    mensaje_brecha: str | None


# ── Entrega (subida de una versión nueva) ─────────────────────────────────────

def subir_entrega(
    db: Session,
    requisito_id: uuid.UUID,
    mandante_id: uuid.UUID,
    empresa_id: uuid.UUID | None,
    trabajador_id: uuid.UUID | None,
    servicio_id: uuid.UUID | None,
    archivos: list[ArchivoEntrada],
    subido_por_usuario_id: uuid.UUID,
) -> ResultadoSubidaDocumento:
    """
    Registra una entrega: resuelve (o crea) el expediente según el alcance
    del requisito, sube los archivos a storage, crea la versión N+1 con sus
    archivos y el evento SUBIDA, y sincroniza el snapshot.

    Si hay un Vision LLM configurado, encola el análisis IA; si no, la
    entrega queda ENVIADO a la espera de revisión manual del mandante.
    """
    requisito = db.get(RequisitoDocumental, requisito_id)
    if not requisito:
        raise EntregaInvalida(f"Requisito {requisito_id} no existe en el catálogo.")

    if (empresa_id is None) == (trabajador_id is None):
        raise EntregaInvalida("La entrega debe indicar empresa_id O trabajador_id (exactamente uno).")
    if requisito.entidad_tipo == EntidadTipo.EMPRESA and empresa_id is None:
        raise EntregaInvalida(f"{requisito.codigo} es un documento de empresa; falta empresa_id.")
    if requisito.entidad_tipo == EntidadTipo.TRABAJADOR and trabajador_id is None:
        raise EntregaInvalida(f"{requisito.codigo} es un documento de trabajador; falta trabajador_id.")

    # Empresa efectiva (para tenant de storage y validación de servicio)
    if trabajador_id:
        trabajador = db.get(Trabajador, trabajador_id)
        if not trabajador:
            raise TrabajadorNoEncontrado(f"Trabajador {trabajador_id} no encontrado.")
        empresa_efectiva_id = trabajador.empresa_id
    else:
        empresa_efectiva_id = empresa_id

    # Alcance: SERVICIO exige servicio coherente; ENTIDAD lo ignora
    if requisito.alcance == Alcance.SERVICIO:
        if servicio_id is None:
            raise EntregaInvalida(
                f"{requisito.codigo} se acredita por servicio; debe indicar servicio_id."
            )
        servicio = db.get(Servicio, servicio_id)
        if (
            not servicio
            or servicio.relacion.mandante_id != mandante_id
            or servicio.relacion.contratista_id != empresa_efectiva_id
        ):
            raise EntregaInvalida("El servicio indicado no corresponde a esta empresa y mandante.")
    else:
        servicio_id = None

    doc = _resolver_documento(db, requisito, mandante_id, empresa_id, trabajador_id, servicio_id)

    if doc.id is not None and doc.version_vigente_id is not None:
        # Re-entrega: solo desde OBSERVADO (corrección) o APROBADO (renovación)
        if doc.estado in (EstadoDocumento.ENVIADO, EstadoDocumento.EN_ANALISIS):
            raise EntregaInvalida(
                f"Ya existe una entrega de {requisito.codigo} pendiente de revisión. "
                "Espere el resultado antes de subir una nueva versión."
            )
        validar_transicion(doc.estado, EstadoDocumento.ENVIADO)

    numero_version = len(doc.versiones) + 1

    # Storage primero, commit de BD después
    subidos = archivo_service.subir_archivos(
        requisito=requisito,
        archivos=archivos,
        mandante_id=mandante_id,
        empresa_id=empresa_efectiva_id,
        entidad_tipo=requisito.entidad_tipo,
        entidad_id=trabajador_id or empresa_id,
        numero_version=numero_version,
        servicio_id=servicio_id,
    )

    estado_anterior = doc.estado if doc.version_vigente_id else None
    version = DocumentoVersion(
        documento=doc,
        numero_version=numero_version,
        estado=EstadoDocumento.ENVIADO,
        subido_por_usuario_id=subido_por_usuario_id,
    )
    db.add(version)
    for a in subidos:
        db.add(ArchivoDocumento(
            version=version,
            orden=a.orden,
            storage_key=a.storage_key,
            nombre_original=a.nombre_original,
            mime_type=a.mime_type,
            tamaño_bytes=a.tamaño_bytes,
            hash_sha256=a.hash_sha256,
        ))
    db.flush()

    doc.estado = EstadoDocumento.ENVIADO
    doc.mensaje_brecha = None
    doc.fecha_vigencia_hasta = None
    doc.version_vigente_id = version.id

    _registrar_evento(
        db, doc, version, TipoEvento.SUBIDA,
        estado_anterior=estado_anterior, estado_nuevo=EstadoDocumento.ENVIADO,
        actor_usuario_id=subido_por_usuario_id,
        detalle={"archivos": [a.nombre_original for a in subidos], "version": numero_version},
    )
    db.commit()
    db.refresh(version)

    if settings.IA_HABILITADA and settings.VISION_LLM_API_KEY:
        # Importación local para evitar circularidad con el worker
        from app.tasks.procesar_documento import procesar_documento_task
        procesar_documento_task.delay(str(version.id))
        mensaje = "Documento recibido, analizando..."
    else:
        mensaje = "Documento recibido, pendiente de revisión del mandante."

    return ResultadoSubidaDocumento(
        documento_id=doc.id,
        version_id=version.id,
        numero_version=numero_version,
        mensaje=mensaje,
    )


def _resolver_documento(
    db: Session,
    requisito: RequisitoDocumental,
    mandante_id: uuid.UUID,
    empresa_id: uuid.UUID | None,
    trabajador_id: uuid.UUID | None,
    servicio_id: uuid.UUID | None,
) -> Documento:
    """Retorna el expediente vivo para la identidad, o crea uno nuevo."""
    query = db.query(Documento).filter_by(
        requisito_id=requisito.id,
        mandante_id=mandante_id,
        servicio_id=servicio_id,
        eliminado_en=None,
    )
    if empresa_id:
        query = query.filter_by(empresa_id=empresa_id)
    else:
        query = query.filter_by(trabajador_id=trabajador_id)
    doc = query.first()
    if doc:
        return doc

    doc = Documento(
        requisito_id=requisito.id,
        mandante_id=mandante_id,
        servicio_id=servicio_id,
        empresa_id=empresa_id,
        trabajador_id=trabajador_id,
        estado=EstadoDocumento.ENVIADO,
    )
    db.add(doc)
    db.flush()
    return doc


# ── Revisión manual (mandante, sin IA) ────────────────────────────────────────

def revisar_documento(
    db: Session,
    documento_id: uuid.UUID,
    usuario_id: uuid.UUID,
    aprobar: bool,
    mensaje_brecha: str | None = None,
    fecha_vigencia_hasta: date | None = None,
) -> None:
    """
    El mandante revisa manualmente la entrega vigente (estado Enviado):
    la aprueba (con fecha de vigencia opcional) o la observa con el motivo.
    """
    doc = obtener_documento(db, documento_id)
    version = doc.version_vigente
    if version is None:
        raise EstadoDocumentoInvalido("El expediente no tiene ninguna entrega para revisar.")
    if not aprobar and not (mensaje_brecha and mensaje_brecha.strip()):
        raise EstadoDocumentoInvalido("Para observar un documento debe indicar el motivo de la brecha.")

    nuevo_estado = EstadoDocumento.APROBADO if aprobar else EstadoDocumento.OBSERVADO
    validar_transicion(doc.estado, nuevo_estado)

    version.estado = nuevo_estado
    version.revisado_por_usuario_id = usuario_id
    version.revisado_en = datetime.now(timezone.utc)
    version.mensaje_brecha = None if aprobar else mensaje_brecha
    version.fecha_vigencia_hasta = fecha_vigencia_hasta if aprobar else None

    estado_anterior = doc.estado
    doc.estado = nuevo_estado
    doc.mensaje_brecha = version.mensaje_brecha
    doc.fecha_vigencia_hasta = version.fecha_vigencia_hasta

    _registrar_evento(
        db, doc, version, TipoEvento.REVISION_MANUAL,
        estado_anterior=estado_anterior, estado_nuevo=nuevo_estado,
        actor_usuario_id=usuario_id,
        detalle={"mensaje_brecha": mensaje_brecha} if not aprobar else None,
    )
    db.commit()
    _recalcular_acreditacion(db, doc)


def aprobar_por_excepcion(
    db: Session,
    documento_id: uuid.UUID,
    usuario_id: uuid.UUID,
    justificacion: str,
) -> None:
    """
    Permite al mandante_admin aprobar manualmente un documento observado.
    Registra quién aprobó, cuándo y con qué justificación — en la versión
    (la excepción aprueba UNA entrega, no el expediente abstracto).
    """
    doc = obtener_documento(db, documento_id)
    if doc.estado != EstadoDocumento.OBSERVADO:
        raise EstadoDocumentoInvalido(
            f"Solo se pueden aprobar por excepción documentos en estado Observado (3). Estado actual: {doc.estado}"
        )
    version = doc.version_vigente
    if version is None:
        raise EstadoDocumentoInvalido("El expediente no tiene ninguna entrega.")

    version.estado = EstadoDocumento.APROBADO
    version.aprobado_por_excepcion = True
    version.justificacion_excepcion = justificacion
    version.aprobado_por_usuario_id = usuario_id
    version.aprobado_en = datetime.now(timezone.utc)

    doc.estado = EstadoDocumento.APROBADO
    doc.mensaje_brecha = None

    _registrar_evento(
        db, doc, version, TipoEvento.EXCEPCION_APROBADA,
        estado_anterior=EstadoDocumento.OBSERVADO, estado_nuevo=EstadoDocumento.APROBADO,
        actor_usuario_id=usuario_id,
        detalle={"justificacion": justificacion},
    )
    db.commit()
    _recalcular_acreditacion(db, doc)


# ── Pipeline IA (activo solo con VISION_LLM_API_KEY configurada) ──────────────

def procesar_documento(
    db: Session,
    version_id: uuid.UUID,
) -> ResultadoAnalisis:
    """
    Ejecutado por el worker Celery sobre UNA versión. Descarga todos los
    archivos de la entrega, los convierte a imágenes y los pasa JUNTOS al
    pipeline (los campos pueden estar repartidos entre archivos).
    """
    version = db.get(DocumentoVersion, version_id)
    if not version:
        raise DocumentoNoEncontrado(f"Versión {version_id} no encontrada.")
    doc = version.documento
    requisito = db.get(RequisitoDocumental, doc.requisito_id)

    _cambiar_estado_version(db, doc, version, EstadoDocumento.EN_ANALISIS, actor=None)

    imagenes: list[bytes] = []
    for archivo in version.archivos:
        pdf_bytes = archivo_service.descargar(archivo.storage_key)
        imagenes.extend(clasificador.pdf_a_imagenes(pdf_bytes))

    resultado_clasificacion = clasificador.clasificar_documento(imagenes[0], requisito.codigo)
    if not resultado_clasificacion.es_valido:
        version.mensaje_brecha = (
            f"El documento no parece ser un {requisito.nombre}. "
            f"Por favor suba el documento correcto."
        )
        _cambiar_estado_version(db, doc, version, EstadoDocumento.OBSERVADO, actor=None)
        return ResultadoAnalisis(
            documento_id=doc.id,
            estado=EstadoDocumento.OBSERVADO,
            campos_extraidos=None,
            mensaje_brecha=version.mensaje_brecha,
        )

    campos = extractor.extraer_campos(imagenes, requisito.codigo)
    campos_dict = campos.model_dump()

    empresa_efectiva = doc.empresa_id or (doc.trabajador.empresa_id if doc.trabajador_id else None)
    resultado_validacion = reglas_service.validar_documento(
        db, requisito.codigo, campos_dict, doc.mandante_id, contratista_id=empresa_efectiva
    )

    version.campos_extraidos = campos_dict
    version.mensaje_brecha = "\n".join(resultado_validacion.brechas) if resultado_validacion.brechas else None

    if resultado_validacion.aprobado:
        fecha_vigencia = campos_dict.get("fecha_vigencia_hasta") or campos_dict.get("fecha_hasta")
        if fecha_vigencia:
            try:
                version.fecha_vigencia_hasta = date.fromisoformat(fecha_vigencia)
            except (ValueError, TypeError):
                pass

    _cambiar_estado_version(db, doc, version, EstadoDocumento(resultado_validacion.estado), actor=None)

    return ResultadoAnalisis(
        documento_id=doc.id,
        estado=doc.estado,
        campos_extraidos=version.campos_extraidos,
        mensaje_brecha=version.mensaje_brecha,
    )


def marcar_version_observada(db: Session, version_id: uuid.UUID, mensaje: str) -> None:
    """Deja una versión observada con mensaje (errores del pipeline IA)."""
    version = db.get(DocumentoVersion, version_id)
    if not version:
        raise DocumentoNoEncontrado(f"Versión {version_id} no encontrada.")
    version.mensaje_brecha = mensaje
    _cambiar_estado_version(db, version.documento, version, EstadoDocumento.OBSERVADO, actor=None)


# ── Lectura ───────────────────────────────────────────────────────────────────

def obtener_documento(db: Session, documento_id: uuid.UUID) -> Documento:
    """Retorna el documento vivo o lanza DocumentoNoEncontrado."""
    doc = db.get(Documento, documento_id)
    if not doc or doc.eliminado_en is not None:
        raise DocumentoNoEncontrado(f"Documento {documento_id} no encontrado.")
    return doc


def listar_documentos_por_entidad(
    db: Session,
    mandante_id: uuid.UUID,
    empresa_id: uuid.UUID | None = None,
    trabajador_id: uuid.UUID | None = None,
) -> list[Documento]:
    """Lista los expedientes vivos de una empresa o trabajador ante un mandante."""
    query = db.query(Documento).filter_by(mandante_id=mandante_id, eliminado_en=None)
    if empresa_id:
        query = query.filter_by(empresa_id=empresa_id)
    if trabajador_id:
        query = query.filter_by(trabajador_id=trabajador_id)
    return query.order_by(Documento.created_at.desc()).all()


def listar_pendientes_revision(db: Session, mandante_id: uuid.UUID) -> list[Documento]:
    """
    Cola de revisión manual del mandante: expedientes Enviados, más los que
    quedaron En Análisis (la máquina de estados permite resolverlos manualmente
    si el pipeline IA no los cerró).
    """
    return (
        db.query(Documento)
        .filter_by(mandante_id=mandante_id, eliminado_en=None)
        .filter(Documento.estado.in_([EstadoDocumento.ENVIADO, EstadoDocumento.EN_ANALISIS]))
        .order_by(Documento.updated_at.asc())
        .all()
    )


# ── Helpers privados ──────────────────────────────────────────────────────────

def _recalcular_acreditacion(db: Session, doc: Documento) -> None:
    """Actualiza el agregado ACREDITADA/BLOQUEADA/EN_PROCESO de la relación."""
    from app.domain import acreditacion_service  # import local: mismo nivel de capa
    contratista_id = doc.empresa_id or (doc.trabajador.empresa_id if doc.trabajador_id else None)
    if contratista_id:
        acreditacion_service.recalcular_estado_global(db, contratista_id, doc.mandante_id)


def _cambiar_estado_version(
    db: Session,
    doc: Documento,
    version: DocumentoVersion,
    nuevo_estado: EstadoDocumento,
    actor: uuid.UUID | None,
) -> None:
    """Transición validada + sincronización de snapshot + evento + commit."""
    validar_transicion(doc.estado, nuevo_estado)
    estado_anterior = doc.estado
    version.estado = nuevo_estado
    doc.estado = nuevo_estado
    doc.mensaje_brecha = version.mensaje_brecha
    doc.fecha_vigencia_hasta = version.fecha_vigencia_hasta
    _registrar_evento(
        db, doc, version, TipoEvento.CAMBIO_ESTADO,
        estado_anterior=estado_anterior, estado_nuevo=nuevo_estado,
        actor_usuario_id=actor,
    )
    db.commit()


def _registrar_evento(
    db: Session,
    doc: Documento,
    version: DocumentoVersion | None,
    tipo: TipoEvento,
    estado_anterior: int | None,
    estado_nuevo: int | None,
    actor_usuario_id: uuid.UUID | None,
    detalle: dict | None = None,
) -> None:
    db.add(DocumentoEvento(
        documento_id=doc.id,
        documento_version_id=version.id if version else None,
        tipo_evento=tipo,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        actor_usuario_id=actor_usuario_id,
        detalle=detalle,
    ))
