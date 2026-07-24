from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "acredita",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.procesar_documento", "app.tasks.vencimientos"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Santiago",
    enable_utc=True,
    # Cron diario de vencimientos (07:00 America/Santiago). Requiere el servicio
    # `beat` (ver docker-compose.prod.yml).
    beat_schedule={
        "revisar-vencimientos-diario": {
            "task": "app.tasks.vencimientos.revisar_vencimientos_task",
            "schedule": crontab(hour=7, minute=0),
        },
    },
)
