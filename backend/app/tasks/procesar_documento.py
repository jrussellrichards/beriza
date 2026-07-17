from app.worker import celery_app


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def procesar_documento_task(self, version_id: str) -> dict:
    """
    Tarea Celery que ejecuta el pipeline completo de análisis IA sobre
    UNA versión (entrega) del documento.

    Solo se encola cuando VISION_LLM_API_KEY está configurada — sin LLM,
    las entregas quedan en estado Enviado para revisión manual del mandante.

    Pipeline:
    1. Descarga todos los archivos de la versión desde storage
    2. Convierte cada PDF a imágenes (procesadas juntas, en orden)
    3. Clasifica el documento — verifica que coincida con el tipo esperado
    4. Extrae campos con el schema Pydantic del requisito
    5. Valida campos con reglas deterministas
    6. Actualiza estado (3=Observado | 4=Aprobado) y registra el evento
    7. Recalcula estado global de acreditación
    8. Notifica resultado por email

    Reintenta hasta 3 veces ante errores transitorios (timeout LLM, BD caída).
    En error permanente, deja la versión Observada con mensaje descriptivo.
    """
    import uuid
    from app.infrastructure.database import SessionLocal
    from app.domain import documento_service, acreditacion_service, notificacion_service
    from app.domain.estados import EstadoDocumento
    from app.core.exceptions import ExcepcionExtraccion
    from app.models.documento import DocumentoVersion

    db = SessionLocal()
    version_uuid = uuid.UUID(version_id)
    try:
        resultado = documento_service.procesar_documento(db, version_uuid)

        version = db.get(DocumentoVersion, version_uuid)
        doc = version.documento
        contratista_id = doc.empresa_id or (doc.trabajador.empresa_id if doc.trabajador_id else None)
        if contratista_id:
            acreditacion_service.recalcular_estado_global(db, contratista_id, doc.mandante_id)

        if resultado.estado == EstadoDocumento.OBSERVADO:
            notificacion_service.notificar_documento_observado(db, doc.id)
        else:
            notificacion_service.notificar_resultado_acreditacion(db, contratista_id, doc.mandante_id)

        return {
            "version_id": version_id,
            "documento_id": str(resultado.documento_id),
            "estado_final": resultado.estado,
            "campos_extraidos": resultado.campos_extraidos,
        }
    except ExcepcionExtraccion as e:
        documento_service.marcar_version_observada(
            db, version_uuid,
            f"No se pudieron extraer los siguientes campos del documento: "
            f"{', '.join(e.campos_fallidos)}. "
            f"Por favor suba una versión más legible.",
        )
        version = db.get(DocumentoVersion, version_uuid)
        notificacion_service.notificar_documento_observado(db, version.documento_id)
        return {"version_id": version_id, "estado_final": 3}
    except Exception as exc:
        try:
            self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            documento_service.marcar_version_observada(
                db, version_uuid,
                "Error interno al analizar el documento. El equipo fue notificado.",
            )
    finally:
        db.close()
