import json

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    VISION_LLM_API_KEY: str = ""
    VISION_LLM_MODEL: str = ""
    # Pipeline IA explícitamente deshabilitado hasta que esté implementado.
    # Con False, las entregas quedan ENVIADO para revisión manual del mandante.
    IA_HABILITADA: bool = False
    FILE_STORAGE: str = "local"       # local | s3
    LOCAL_STORAGE_PATH: str = "uploads"
    S3_ENDPOINT: str = ""
    S3_BUCKET: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    RESEND_API_KEY: str = ""
    # String crudo del env: acepta JSON (["https://a.cl"]) o separado por
    # comas (https://a.cl, https://b.cl). Se declara str porque
    # pydantic-settings 2.5 exige JSON en campos List y revienta con el
    # formato de los .env de producción. Usar ALLOWED_ORIGINS_LIST.
    ALLOWED_ORIGINS: str = '["http://localhost:3000", "http://localhost:3001"]'

    @property
    def ALLOWED_ORIGINS_LIST(self) -> List[str]:
        v = self.ALLOWED_ORIGINS.strip()
        if v.startswith("["):
            return json.loads(v)
        return [origen.strip() for origen in v.split(",") if origen.strip()]

    # Validación de archivos (default global; cada requisito puede restringir más)
    MAX_ARCHIVO_MB: int = 20
    FORMATOS_PERMITIDOS_DEFAULT: List[str] = ["application/pdf"]

    class Config:
        env_file = (".env", "../.env")


settings = Settings()
