"""
Orquestación del expediente documental (modelo Fase 1).

Separa la biblioteca del contratista (Expediente → Entrega → Archivo) de la
revisión por mandante (Acreditacion). Ver docs/rediseno-modelo-documentos.md.

- La subida crea/resuelve el Expediente (sin mandante), agrega una Entrega
  (con de-dup por hash) y fija la Acreditacion del mandante a esa entrega.
- La revisión y la excepción operan sobre la Acreditacion (estado por mandante).
- La vigencia objetiva vive en la Entrega; el umbral por mandante en el perfil.

Los nombres públicos (subir_entrega, revisar_documento, aprobar_por_excepcion,
obtener_documento, listar_pendientes_revision) se mantienen para la capa API;
"documento_id" en esa capa es ahora el id de la Acreditacion.
"""
import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import or_
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
from app.models.expediente import Acreditacion, AcreditacionEvento, Archivo, Entrega, Expediente
from app.models.pilar import RequisitoDocumental
from app.models.servicio import Servicio
from app.models.trabajador import Trabajador

logger = logging.getLogger("acredita")


@dataclass
class ResultadoSubidaDocumento:
    documento_id: uuid.UUID   # id de la Acreditacion (contrato con la capa API)
    version_id: uuid.UUID     # id de la Entrega
    numero_version: int
    mensaje: str


@dataclass
class ResultadoAnalisis:
    documento_id: uuid.UUID
    estado: int
    campos_extraidos: dict | None
    mensaje_brecha: str | None


# ── Subida de una entrega ─────────────────────────────────────────────────────

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
    Registra una entrega: resuelve (o crea) el Expediente del contratista según
    el alcance del requisito, sube los archivos (con de-dup por hash), y fija la
    Acreditacion del mandante a esa entrega en estado ENVIADO.
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

    # Alcance: SERVICIO exige servicio coherente con esta empresa y mandante;
    # ENTIDAD lo ignora (el expediente es compartido entre servicios).
    if requisito.alcance == Alcance.SERVICIO:
        if servicio_id is None:
            raise EntregaInvalida(f"{requisito.codigo} se acredita por servicio; debe indicar servicio_id.")
        servicio = db.get(Servicio, servicio_id)
        if (
            not servicio
            or servicio.relacion.mandante_id != mandante_id
            or servicio.relacion.contratista_id != empresa_efectiva_id
        ):
            raise EntregaInvalida("El servicio indicado no corresponde a esta empresa y mandante.")
        if servicio.archivado_en is not None:
            # Sin esto se le podrían seguir subiendo documentos a una faena que
            # ya nadie ve en ninguna lista, y esos documentos quedarían en la
            # cola de revisión del mandante sin forma de llegar a ellos.
            raise EntregaInvalida(
                f"«{servicio.nombre}» está archivado y no admite documentos nuevos. "
                "Desarchívalo si hace falta entregar algo más."
            )
    else:
        servicio_id = None

    expediente = _resolver_expediente(db, requisito, empresa_id, trabajador_id, servicio_id)
    acred = _resolver_acreditacion(db, expediente, mandante_id)

    # Re-entrega. Desde ENVIADO es un REEMPLAZO: el contratista se dio cuenta de
    # que subió el documento equivocado y nadie lo ha revisado todavía.
    #
    # Antes estaba prohibido y había que esperar a que el mandante rechazara algo
    # que el contratista ya sabía que estaba malo. Eso hacía perder el tiempo a
    # los dos: el mandante revisaba un documento muerto.
    #
    # Lo que se pidió fue poder BORRARLO. No se puede, y no por prolijidad: este
    # producto existe para responder qué entregó el contratista y cuándo. Si se
    # puede borrar, quien subió un documento adulterado lo hace desaparecer. El
    # reemplazo resuelve el mismo dolor sin ese costo — la entrega anterior queda
    # en el expediente y sus dos eventos en la bitácora; lo único que cambia es a
    # cuál apunta la acreditación.
    if acred.entrega_id is not None:
        if acred.estado == EstadoDocumento.EN_ANALISIS:
            # Este sí se queda bloqueado, y no por olvido: hay una tarea de IA
            # corriendo sobre la entrega vieja que, al terminar, escribe su
            # resultado en la acreditación. Si se reemplaza mientras tanto, ese
            # veredicto se aplica al documento equivocado.
            #
            # La forma correcta de abrirlo es que procesar_documento compruebe
            # que acred.entrega_id sigue siendo la entrega que analizó antes de
            # escribir. Mientras el pipeline esté apagado no hace falta, pero
            # quien lo encienda tiene que resolver esto primero.
            raise EntregaInvalida(
                f"El {requisito.codigo} que subiste se está analizando en este "
                "momento. Espera a que termine para subir otra versión."
            )
        validar_transicion(acred.estado, EstadoDocumento.ENVIADO)

    # De-dup por contenido: si el set de archivos es idéntico a la última entrega
    # del expediente, se reusa esa entrega en vez de crear una versión nueva.
    archivo_service.validar_entrega(requisito, archivos)
    hashes_nuevos = [archivo_service.calcular_hash(a.contenido) for a in archivos]
    ultima = expediente.entregas[-1] if expediente.entregas else None

    if ultima is not None and _mismos_archivos(ultima, hashes_nuevos):
        entrega = ultima
        entrega_creada = False
    else:
        numero_version = len(expediente.entregas) + 1
        subidos = archivo_service.subir_archivos(
            requisito=requisito,
            archivos=archivos,
            empresa_id=empresa_efectiva_id,
            entidad_tipo=requisito.entidad_tipo,
            entidad_id=trabajador_id or empresa_id,
            numero_version=numero_version,
            servicio_id=servicio_id,
        )
        entrega = Entrega(
            expediente=expediente,
            numero_version=numero_version,
            subido_por_usuario_id=subido_por_usuario_id,
        )
        db.add(entrega)
        for a in subidos:
            db.add(Archivo(
                entrega=entrega, orden=a.orden, storage_key=a.storage_key,
                nombre_original=a.nombre_original, mime_type=a.mime_type,
                tamaño_bytes=a.tamaño_bytes, hash_sha256=a.hash_sha256,
            ))
        db.flush()
        entrega_creada = True

    estado_anterior = acred.estado if acred.entrega_id else None
    acred.entrega_id = entrega.id
    acred.numero_version = entrega.numero_version
    acred.estado = EstadoDocumento.ENVIADO
    acred.mensaje_brecha = None
    db.flush()

    _registrar_evento(
        db, acred, TipoEvento.SUBIDA,
        estado_anterior=estado_anterior, estado_nuevo=EstadoDocumento.ENVIADO,
        actor_usuario_id=subido_por_usuario_id,
        detalle={"version": entrega.numero_version, "archivos": [a.nombre_original for a in archivos]},
    )
    _avanzar_otros_mandantes(db, expediente, acred, entrega, subido_por_usuario_id)
    db.commit()

    # Un documento de alcance ENTIDAD vale para todos los mandantes, no solo para
    # aquel al que se le subió. Best-effort: la entrega ya está confirmada y no
    # debe perderse porque la propagación falle.
    if requisito.alcance == Alcance.ENTIDAD:
        from app.domain import notificacion_service, reutilizacion_service
        try:
            propagadas = reutilizacion_service.reconciliar_todos_los_mandantes(
                db, empresa_efectiva_id, excepto_mandante_id=mandante_id
            )
            # Solo se avisa de lo que necesita acción del contratista: que un
            # documento sensible quedó esperando su autorización. Que un genérico
            # se aplique a otro mandante es justo lo que pidió al subirlo, y
            # mandarle un mail por cada mandante sería ruido.
            for mid, creadas in propagadas.items():
                if any(a.estado == EstadoDocumento.PENDIENTE_AUTORIZACION for a in creadas):
                    notificacion_service.notificar_reutilizacion(
                        db, empresa_efectiva_id, mid, creadas
                    )
        except Exception:
            db.rollback()
            logger.exception(
                "Falló la propagación de %s del contratista %s al resto de sus mandantes",
                requisito.codigo, empresa_efectiva_id,
            )

    if entrega_creada and settings.IA_HABILITADA and settings.VISION_LLM_API_KEY:
        from app.tasks.procesar_documento import procesar_documento_task
        procesar_documento_task.delay(str(entrega.id))
        mensaje = "Documento recibido, analizando..."
    else:
        mensaje = "Documento recibido, pendiente de revisión del mandante."

    return ResultadoSubidaDocumento(
        documento_id=acred.id,
        version_id=entrega.id,
        numero_version=entrega.numero_version,
        mensaje=mensaje,
    )


def _avanzar_otros_mandantes(
    db: Session,
    expediente: Expediente,
    acred_subida: Acreditacion,
    entrega: Entrega,
    usuario_id: uuid.UUID,
) -> None:
    """
    El contratista sube UNA versión de su documento; los demás mandantes que lo
    exigen deben verla también. Si no, subir una corrección para un cliente
    dejaría a los otros mirando la versión que ya fue rechazada.

    Excepción: el que tiene APROBADA una entrega aún vigente NO se mueve.
    Moverlo lo devolvería a revisión y lo desacreditaría mientras su documento
    sigue siendo válido. Cuando esa vigencia expire, el cron de vencimientos
    hace el auto-repin. Es el pin explícito de Fase 1.
    """
    hoy = date.today()
    for otra in expediente.acreditaciones:
        if otra.id == acred_subida.id or otra.eliminado_en is not None:
            continue
        # Un documento sensible sin autorizar no se comparte por la puerta trasera
        if otra.estado == EstadoDocumento.PENDIENTE_AUTORIZACION:
            continue
        if otra.entrega_id == entrega.id:
            continue
        if otra.estado == EstadoDocumento.APROBADO:
            vigencia = otra.entrega.fecha_vigencia_hasta if otra.entrega else None
            if vigencia is None or vigencia >= hoy:
                continue   # aprobado y vigente: no lo desacreditamos

        estado_anterior = otra.estado if otra.entrega_id else None
        otra.entrega_id = entrega.id
        otra.numero_version = entrega.numero_version
        otra.estado = EstadoDocumento.ENVIADO
        otra.mensaje_brecha = None
        db.flush()
        _registrar_evento(
            db, otra, TipoEvento.SUBIDA,
            estado_anterior=estado_anterior, estado_nuevo=EstadoDocumento.ENVIADO,
            actor_usuario_id=usuario_id,
            detalle={"version": entrega.numero_version, "propagada": True},
        )


def _mismos_archivos(entrega: Entrega, hashes_nuevos: list[str]) -> bool:
    """True si la entrega tiene exactamente los mismos archivos (por hash, en orden)."""
    hashes_entrega = [a.hash_sha256 for a in sorted(entrega.archivos, key=lambda x: x.orden)]
    return hashes_entrega == hashes_nuevos


def _resolver_expediente(
    db: Session,
    requisito: RequisitoDocumental,
    empresa_id: uuid.UUID | None,
    trabajador_id: uuid.UUID | None,
    servicio_id: uuid.UUID | None,
) -> Expediente:
    """Expediente vivo del contratista para la identidad (requisito, entidad, servicio?), o uno nuevo."""
    query = db.query(Expediente).filter_by(
        requisito_id=requisito.id, servicio_id=servicio_id, eliminado_en=None
    )
    if empresa_id:
        query = query.filter_by(empresa_id=empresa_id, trabajador_id=None)
    else:
        query = query.filter_by(trabajador_id=trabajador_id, empresa_id=None)
    exp = query.first()
    if exp:
        return exp

    exp = Expediente(
        requisito_id=requisito.id, empresa_id=empresa_id,
        trabajador_id=trabajador_id, servicio_id=servicio_id,
    )
    db.add(exp)
    db.flush()
    return exp


def _resolver_acreditacion(db: Session, expediente: Expediente, mandante_id: uuid.UUID) -> Acreditacion:
    """Acreditacion viva del mandante sobre el expediente, o una nueva."""
    acred = (
        db.query(Acreditacion)
        .filter_by(expediente_id=expediente.id, mandante_id=mandante_id, eliminado_en=None)
        .first()
    )
    if acred:
        return acred
    acred = Acreditacion(
        expediente_id=expediente.id, mandante_id=mandante_id, estado=EstadoDocumento.ENVIADO,
    )
    db.add(acred)
    db.flush()
    return acred


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
    El mandante revisa la entrega fijada en SU acreditación: la aprueba (con
    fecha de vigencia opcional, que se escribe en la Entrega compartida solo si
    aún no la tiene) o la observa con el motivo.
    """
    acred = obtener_documento(db, documento_id)
    if acred.entrega_id is None:
        raise EstadoDocumentoInvalido("La acreditación no tiene ninguna entrega para revisar.")
    if not aprobar and not (mensaje_brecha and mensaje_brecha.strip()):
        raise EstadoDocumentoInvalido("Para observar un documento debe indicar el motivo de la brecha.")

    nuevo_estado = EstadoDocumento.APROBADO if aprobar else EstadoDocumento.OBSERVADO
    validar_transicion(acred.estado, nuevo_estado)

    estado_anterior = acred.estado
    acred.estado = nuevo_estado
    acred.revisado_por_usuario_id = usuario_id
    acred.revisado_en = datetime.now(timezone.utc)
    acred.mensaje_brecha = None if aprobar else mensaje_brecha

    # La vigencia es un hecho del documento → vive en la Entrega (compartida).
    # El mandante solo la ingresa como fallback si la IA no la extrajo; no pisa
    # una fecha ya existente (Fase 2: alerta de discrepancia).
    if aprobar and fecha_vigencia_hasta is not None and acred.entrega.fecha_vigencia_hasta is None:
        acred.entrega.fecha_vigencia_hasta = fecha_vigencia_hasta

    _registrar_evento(
        db, acred, TipoEvento.REVISION_MANUAL,
        estado_anterior=estado_anterior, estado_nuevo=nuevo_estado,
        actor_usuario_id=usuario_id,
        detalle={"mensaje_brecha": mensaje_brecha} if not aprobar else None,
    )
    db.commit()
    _recalcular_acreditacion(db, acred)


def aprobar_por_excepcion(
    db: Session,
    documento_id: uuid.UUID,
    usuario_id: uuid.UUID,
    justificacion: str,
) -> None:
    """Aprueba manualmente una acreditación observada, dejando la justificación."""
    acred = obtener_documento(db, documento_id)
    if acred.estado != EstadoDocumento.OBSERVADO:
        raise EstadoDocumentoInvalido(
            f"Solo se pueden aprobar por excepción documentos en estado Observado (3). Estado actual: {acred.estado}"
        )
    if acred.entrega_id is None:
        raise EstadoDocumentoInvalido("La acreditación no tiene ninguna entrega.")

    acred.estado = EstadoDocumento.APROBADO
    acred.mensaje_brecha = None
    acred.aprobado_por_excepcion = True
    acred.justificacion_excepcion = justificacion
    acred.aprobado_por_usuario_id = usuario_id
    acred.aprobado_en = datetime.now(timezone.utc)

    _registrar_evento(
        db, acred, TipoEvento.EXCEPCION_APROBADA,
        estado_anterior=EstadoDocumento.OBSERVADO, estado_nuevo=EstadoDocumento.APROBADO,
        actor_usuario_id=usuario_id,
        detalle={"justificacion": justificacion},
    )
    db.commit()
    _recalcular_acreditacion(db, acred)


# ── Pipeline IA (activo solo con VISION_LLM_API_KEY configurada) ──────────────

def procesar_documento(db: Session, entrega_id: uuid.UUID) -> ResultadoAnalisis:
    """
    Ejecutado por el worker sobre UNA entrega. Extrae campos y vigencia (que
    viven en la Entrega, compartida), y evalúa cada acreditación que la fija
    contra las reglas de su propio mandante. Sin IA configurada nunca se llama.
    """
    entrega = db.get(Entrega, entrega_id)
    if not entrega:
        raise DocumentoNoEncontrado(f"Entrega {entrega_id} no encontrada.")
    expediente = entrega.expediente
    requisito = db.get(RequisitoDocumental, expediente.requisito_id)
    acreditaciones = [
        a for a in expediente.acreditaciones
        if a.entrega_id == entrega.id and a.eliminado_en is None
    ]

    for acred in acreditaciones:
        _cambiar_estado(db, acred, EstadoDocumento.EN_ANALISIS, actor=None)

    imagenes: list[bytes] = []
    for archivo in entrega.archivos:
        pdf_bytes = archivo_service.descargar(archivo.storage_key)
        imagenes.extend(clasificador.pdf_a_imagenes(pdf_bytes))

    clasif = clasificador.clasificar_documento(imagenes[0], requisito.codigo) if imagenes else None
    if clasif is not None and not clasif.es_valido:
        msg = f"El documento no parece ser un {requisito.nombre}. Por favor suba el documento correcto."
        for acred in acreditaciones:
            acred.mensaje_brecha = msg
            _cambiar_estado(db, acred, EstadoDocumento.OBSERVADO, actor=None)
        return ResultadoAnalisis(
            documento_id=acreditaciones[0].id if acreditaciones else entrega.id,
            estado=EstadoDocumento.OBSERVADO, campos_extraidos=None, mensaje_brecha=msg,
        )

    campos = extractor.extraer_campos(imagenes, requisito.codigo)
    campos_dict = campos.model_dump() if hasattr(campos, "model_dump") else dict(campos or {})
    entrega.campos_extraidos = campos_dict
    if campos_dict.get("fecha_vigencia_hasta"):
        entrega.fecha_vigencia_hasta = campos_dict["fecha_vigencia_hasta"]
    if campos_dict.get("fecha_emision"):
        entrega.fecha_emision = campos_dict["fecha_emision"]

    ultimo_estado = EstadoDocumento.APROBADO
    ultimo_msg = None
    for acred in acreditaciones:
        resultado = reglas_service.validar_documento(
            db, requisito.id, campos_dict, acred.mandante_id,
            contratista_id=expediente.empresa_duena_id,
        )
        acred.mensaje_brecha = None if resultado.aprobado else "; ".join(resultado.brechas)
        _cambiar_estado(db, acred, resultado.estado, actor=None)
        ultimo_estado, ultimo_msg = resultado.estado, acred.mensaje_brecha

    return ResultadoAnalisis(
        documento_id=acreditaciones[0].id if acreditaciones else entrega.id,
        estado=ultimo_estado, campos_extraidos=campos_dict, mensaje_brecha=ultimo_msg,
    )


def marcar_entrega_observada(db: Session, entrega_id: uuid.UUID, mensaje: str) -> None:
    """Deja observadas las acreditaciones que fijan esta entrega (errores del pipeline IA)."""
    entrega = db.get(Entrega, entrega_id)
    if not entrega:
        raise DocumentoNoEncontrado(f"Entrega {entrega_id} no encontrada.")
    for acred in entrega.expediente.acreditaciones:
        if acred.entrega_id == entrega.id and acred.eliminado_en is None:
            acred.mensaje_brecha = mensaje
            _cambiar_estado(db, acred, EstadoDocumento.OBSERVADO, actor=None)


# ── Lectura ───────────────────────────────────────────────────────────────────

def obtener_documento(db: Session, documento_id: uuid.UUID) -> Acreditacion:
    """Retorna la Acreditacion viva o lanza DocumentoNoEncontrado."""
    acred = db.get(Acreditacion, documento_id)
    if not acred or acred.eliminado_en is not None:
        raise DocumentoNoEncontrado(f"Acreditación {documento_id} no encontrada.")
    return acred


def listar_pendientes_revision(db: Session, mandante_id: uuid.UUID) -> list[Acreditacion]:
    """Cola de revisión manual del mandante: acreditaciones Enviadas o En Análisis."""
    # El outerjoin y el or_ son necesarios: un expediente de alcance ENTIDAD no
    # tiene servicio (servicio_id NULL) y un inner join lo dejaría fuera, que es
    # la mayoría de la cola. Sin este filtro, los documentos de una faena
    # archivada se quedan en la cola del mandante PARA SIEMPRE, y nadie puede
    # abrirlos porque la faena ya no aparece en ninguna lista.
    return (
        db.query(Acreditacion)
        .join(Expediente, Acreditacion.expediente_id == Expediente.id)
        .outerjoin(Servicio, Expediente.servicio_id == Servicio.id)
        .filter(Acreditacion.mandante_id == mandante_id, Acreditacion.eliminado_en.is_(None))
        .filter(Acreditacion.estado.in_([EstadoDocumento.ENVIADO, EstadoDocumento.EN_ANALISIS]))
        .filter(or_(Expediente.servicio_id.is_(None), Servicio.archivado_en.is_(None)))
        .order_by(Acreditacion.updated_at.asc())
        .all()
    )


# ── Helpers privados ──────────────────────────────────────────────────────────

def _recalcular_acreditacion(db: Session, acred: Acreditacion) -> None:
    """Actualiza el agregado ACREDITADA/BLOQUEADA/EN_PROCESO de la relación."""
    from app.domain import acreditacion_service  # import local: mismo nivel de capa
    exp = acred.expediente
    contratista_id = exp.empresa_duena_id
    if contratista_id:
        acreditacion_service.recalcular_estado_global(db, contratista_id, acred.mandante_id)


def _cambiar_estado(db: Session, acred: Acreditacion, nuevo_estado: int, actor: uuid.UUID | None) -> None:
    """Transición validada + evento + commit (usado por el pipeline IA)."""
    validar_transicion(acred.estado, nuevo_estado)
    estado_anterior = acred.estado
    acred.estado = nuevo_estado
    _registrar_evento(
        db, acred, TipoEvento.CAMBIO_ESTADO,
        estado_anterior=estado_anterior, estado_nuevo=nuevo_estado, actor_usuario_id=actor,
    )
    db.commit()


def _registrar_evento(
    db: Session,
    acred: Acreditacion,
    tipo: TipoEvento,
    estado_anterior: int | None,
    estado_nuevo: int | None,
    actor_usuario_id: uuid.UUID | None,
    detalle: dict | None = None,
) -> None:
    db.add(AcreditacionEvento(
        acreditacion_id=acred.id,
        tipo_evento=tipo,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        actor_usuario_id=actor_usuario_id,
        detalle=detalle,
    ))
