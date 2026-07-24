from app.worker import celery_app


@celery_app.task(name="app.tasks.vencimientos.revisar_vencimientos_task")
def revisar_vencimientos_task() -> dict:
    """
    Tarea diaria (Celery beat). Reconcilia vencimientos y envía el digest de
    alertas por contratista:
    1. Documentos aprobados cuya vigencia expiró → VENCIDO, o auto-repin a una
       entrega vigente posterior (decisión A).
    2. Documentos que vencen en 30/15/7/1 días → email de aviso al contratista.
    """
    from app.infrastructure.database import SessionLocal
    from app.domain import vencimiento_service, notificacion_service

    db = SessionLocal()
    try:
        resultado = vencimiento_service.procesar_vencimientos(db)
        alertas = vencimiento_service.alertas_de_vencimiento(db)
        for contratista_id, items in alertas.items():
            notificacion_service.notificar_proximos_vencimientos(db, contratista_id, items)
        return {
            "renovadas": resultado["renovadas"],
            "vencidas": resultado["vencidas"],
            "contratistas_alertados": len(alertas),
        }
    finally:
        db.close()
