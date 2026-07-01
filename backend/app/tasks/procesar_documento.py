from app.worker import celery_app


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def procesar_documento_task(self, documento_id: str) -> dict:
    """
    Tarea Celery que ejecuta el pipeline completo de análisis IA para un documento.

    Pipeline:
    1. Descarga PDF desde storage
    2. Convierte PDF a imágenes
    3. Clasifica el documento — verifica que coincida con el tipo esperado
    4. Extrae campos con el schema Pydantic del requisito
    5. Valida campos con reglas deterministas
    6. Actualiza estado del documento (3=Observado | 4=Aprobado)
    7. Recalcula estado global de acreditación
    8. Notifica resultado por email

    Reintenta hasta 3 veces ante errores transitorios (timeout LLM, BD caída).
    En error permanente, deja el documento en estado 3 con mensaje descriptivo.
    """
    import uuid
    from app.infrastructure.database import SessionLocal
    from app.domain import documento_service, acreditacion_service, notificacion_service
    from app.core.exceptions import ExcepcionExtraccion

    db = SessionLocal()
    doc_uuid = uuid.UUID(documento_id)
    try:
        resultado = documento_service.procesar_documento(db, doc_uuid)

        doc = documento_service.obtener_documento(db, doc_uuid)
        contratista_id = doc.empresa_id or (doc.trabajador.empresa_id if doc.trabajador_id else None)
        if contratista_id:
            acreditacion_service.recalcular_estado_global(db, contratista_id, doc.mandante_id)

        if resultado.estado == 3:
            notificacion_service.notificar_documento_observado(db, doc_uuid)
        else:
            notificacion_service.notificar_resultado_acreditacion(db, contratista_id, doc.mandante_id)

        return {
            "documento_id": documento_id,
            "estado_final": resultado.estado,
            "campos_extraidos": resultado.campos_extraidos,
        }
    except ExcepcionExtraccion as e:
        doc = documento_service.obtener_documento(db, doc_uuid)
        doc.estado = 3
        doc.mensaje_brecha = (
            f"No se pudieron extraer los siguientes campos del documento: "
            f"{', '.join(e.campos_fallidos)}. "
            f"Por favor suba una versión más legible."
        )
        db.commit()
        notificacion_service.notificar_documento_observado(db, doc_uuid)
        return {"documento_id": documento_id, "estado_final": 3}
    except Exception as exc:
        try:
            self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            doc = documento_service.obtener_documento(db, doc_uuid)
            doc.estado = 3
            doc.mensaje_brecha = "Error interno al analizar el documento. El equipo fue notificado."
            db.commit()
    finally:
        db.close()
