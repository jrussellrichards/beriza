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
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    # Validación de archivos (default global; cada requisito puede restringir más)
    MAX_ARCHIVO_MB: int = 20
    FORMATOS_PERMITIDOS_DEFAULT: List[str] = ["application/pdf"]

    class Config:
        env_file = (".env", "../.env")


settings = Settings()
