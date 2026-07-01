import os
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

import boto3
from botocore.config import Config

from app.core.config import settings


@dataclass
class ArchivoSubido:
    url: str        # URL relativa o S3 key — nunca URL firmada
    nombre: str
    tamaño_bytes: int


class StorageBase(ABC):
    """
    Interfaz de storage. El dominio llama a esta abstracción —
    nunca sabe si está hablando con disco local o Hetzner S3.
    """

    @abstractmethod
    def subir(self, contenido: bytes, nombre_archivo: str, carpeta: str) -> ArchivoSubido:
        """Sube un archivo y retorna su URL de acceso interno."""
        ...

    @abstractmethod
    def obtener_url_firmada(self, url: str, expira_en_segundos: int = 3600) -> str:
        """
        Genera una URL temporal firmada para descarga segura.
        En local retorna la URL directa. En S3 genera una presigned URL.
        """
        ...

    @abstractmethod
    def eliminar(self, url: str) -> None:
        """Elimina un archivo del storage."""
        ...


class StorageLocal(StorageBase):
    """Implementación para desarrollo local. Guarda en LOCAL_STORAGE_PATH."""

    def __init__(self):
        self.base_path = Path(settings.LOCAL_STORAGE_PATH)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def subir(self, contenido: bytes, nombre_archivo: str, carpeta: str) -> ArchivoSubido:
        nombre_unico = f"{uuid.uuid4().hex}_{nombre_archivo}"
        destino = self.base_path / carpeta / nombre_unico
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(contenido)
        url = f"{carpeta}/{nombre_unico}"
        return ArchivoSubido(url=url, nombre=nombre_archivo, tamaño_bytes=len(contenido))

    def obtener_url_firmada(self, url: str, expira_en_segundos: int = 3600) -> str:
        # En local la "URL firmada" es la ruta completa del archivo
        return str(self.base_path / url)

    def eliminar(self, url: str) -> None:
        ruta = self.base_path / url
        if ruta.exists():
            ruta.unlink()


class StorageS3(StorageBase):
    """Implementación para producción. Usa Hetzner Object Storage (compatible S3)."""

    def __init__(self):
        self.bucket = settings.S3_BUCKET
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=Config(signature_version="s3v4"),
        )

    def subir(self, contenido: bytes, nombre_archivo: str, carpeta: str) -> ArchivoSubido:
        nombre_unico = f"{uuid.uuid4().hex}_{nombre_archivo}"
        key = f"{carpeta}/{nombre_unico}"
        self.client.put_object(Bucket=self.bucket, Key=key, Body=contenido)
        return ArchivoSubido(url=key, nombre=nombre_archivo, tamaño_bytes=len(contenido))

    def obtener_url_firmada(self, url: str, expira_en_segundos: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": url},
            ExpiresIn=expira_en_segundos,
        )

    def eliminar(self, url: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=url)


def get_storage() -> StorageBase:
    """
    Factory que retorna la implementación correcta según FILE_STORAGE en .env.
    El dominio siempre llama a esto — nunca instancia StorageLocal o StorageS3 directamente.
    """
    if settings.FILE_STORAGE == "s3":
        return StorageS3()
    return StorageLocal()
