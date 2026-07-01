from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "acredita",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.procesar_documento"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Santiago",
    enable_utc=True,
)
