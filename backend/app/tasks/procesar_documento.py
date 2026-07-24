from app.worker import celery_app


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def procesar_documento_task(self, entrega_id: str) -> dict:
    """
    Tarea Celery que ejecuta el pipeline de análisis IA sobre UNA entrega.

    Solo se encola cuando VISION_LLM_API_KEY está configurada — sin LLM, las
    entregas quedan en estado Enviado para revisión manual del mandante.

    Pipeline:
    1. Descarga los archivos de la entrega y los convierte a imágenes.
    2. Clasifica y extrae campos (vigencia/emisión → viven en la Entrega).
    3. Valida contra las reglas de cada mandante que fija esta entrega.
    4. Actualiza el estado de cada acreditación y registra el evento.
    5. Recalcula el estado global y notifica por email.

    Reintenta hasta 3 veces ante errores transitorios; en error permanente deja
    las acreditaciones observadas con un mensaje descriptivo.
    """
    import uuid
    from app.infrastructure.database import SessionLocal
    from app.domain import documento_service, acreditacion_service, notificacion_service
    from app.domain.estados import EstadoDocumento
    from app.core.exceptions import ExcepcionExtraccion
    from app.models.expediente import Entrega

    db = SessionLocal()
    entrega_uuid = uuid.UUID(entrega_id)
    try:
        resultado = documento_service.procesar_documento(db, entrega_uuid)

        entrega = db.get(Entrega, entrega_uuid)
        exp = entrega.expediente
        contratista_id = exp.empresa_id or (exp.trabajador.empresa_id if exp.trabajador_id else None)
        acreditaciones = [
            a for a in exp.acreditaciones if a.entrega_id == entrega.id and a.eliminado_en is None
        ]
        for acred in acreditaciones:
            if contratista_id:
                acreditacion_service.recalcular_estado_global(db, contratista_id, acred.mandante_id)
            if acred.estado == EstadoDocumento.OBSERVADO:
                notificacion_service.notificar_documento_observado(db, acred.id)
            elif contratista_id:
                notificacion_service.notificar_resultado_acreditacion(db, contratista_id, acred.mandante_id)

        return {
            "entrega_id": entrega_id,
            "documento_id": str(resultado.documento_id),
            "estado_final": resultado.estado,
            "campos_extraidos": resultado.campos_extraidos,
        }
    except ExcepcionExtraccion as e:
        mensaje = (
            f"No se pudieron extraer los siguientes campos del documento: "
            f"{', '.join(e.campos_fallidos)}. Por favor suba una versión más legible."
        )
        documento_service.marcar_entrega_observada(db, entrega_uuid, mensaje)
        entrega = db.get(Entrega, entrega_uuid)
        for acred in entrega.expediente.acreditaciones:
            if acred.entrega_id == entrega.id and acred.eliminado_en is None:
                notificacion_service.notificar_documento_observado(db, acred.id)
        return {"entrega_id": entrega_id, "estado_final": 3}
    except Exception as exc:
        try:
            self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            documento_service.marcar_entrega_observada(
                db, entrega_uuid,
                "Error interno al analizar el documento. El equipo fue notificado.",
            )
    finally:
        db.close()
