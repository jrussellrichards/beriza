"""
Manejo de archivos de una entrega documental.

Responsabilidad única: validar los archivos contra la configuración del
requisito (data-driven, nada hardcodeado), calcular su hash de integridad,
construir la key determinística de storage y subirlos/descargarlos vía
StorageBase. NO decide estados ni toca el expediente — eso es
documento_service.
"""
import hashlib
import uuid
from dataclasses import dataclass
from pathlib import PurePosixPath

from app.core.config import settings
from app.core.exceptions import ArchivoInvalido
from app.domain.estados import Alcance
from app.infrastructure.storage import get_storage
from app.models.pilar import RequisitoDocumental


@dataclass
class ArchivoEntrada:
    """Un archivo recibido en la entrega, aún sin validar."""
    contenido: bytes
    nombre_original: str
    mime_type: str


@dataclass
class ArchivoValidado:
    """Archivo validado y subido a storage, listo para persistir en BD."""
    storage_key: str
    nombre_original: str
    mime_type: str
    tamaño_bytes: int
    hash_sha256: str
    orden: int


def validar_entrega(requisito: RequisitoDocumental, archivos: list[ArchivoEntrada]) -> None:
    """
    Valida la entrega completa contra la config del requisito y los límites
    globales de settings. Lanza ArchivoInvalido con mensaje accionable.
    """
    if not archivos:
        raise ArchivoInvalido("La entrega debe incluir al menos un archivo.")

    if len(archivos) > requisito.max_archivos:
        raise ArchivoInvalido(
            f"{requisito.nombre} admite máximo {requisito.max_archivos} "
            f"archivo(s) por entrega; se recibieron {len(archivos)}."
        )

    formatos = requisito.formatos_permitidos or settings.FORMATOS_PERMITIDOS_DEFAULT
    max_bytes = settings.MAX_ARCHIVO_MB * 1024 * 1024
    for a in archivos:
        if a.mime_type not in formatos:
            raise ArchivoInvalido(
                f"Formato no permitido para {requisito.codigo}: {a.mime_type}. "
                f"Formatos aceptados: {', '.join(formatos)}."
            )
        if len(a.contenido) > max_bytes:
            raise ArchivoInvalido(
                f"El archivo '{a.nombre_original}' supera el límite de {settings.MAX_ARCHIVO_MB} MB."
            )
        if len(a.contenido) == 0:
            raise ArchivoInvalido(f"El archivo '{a.nombre_original}' está vacío.")


def construir_key(
    requisito: RequisitoDocumental,
    mandante_id: uuid.UUID,
    empresa_id: uuid.UUID,
    entidad_tipo: str,
    entidad_id: uuid.UUID,
    numero_version: int,
    nombre_original: str,
    servicio_id: uuid.UUID | None,
) -> str:
    """
    Key determinística y particionada por tenant:
      ENTIDAD:  {mandante}/{empresa}/entidad/{empresa|trabajador}/{entidad}/{REQ}/v{n}/{uuid}.{ext}
      SERVICIO: {mandante}/{empresa}/servicio/{servicio}/{empresa|trabajador}/{entidad}/{REQ}/v{n}/{uuid}.{ext}
    """
    ext = PurePosixPath(nombre_original).suffix.lstrip(".").lower() or "bin"
    segmento_alcance = (
        f"servicio/{servicio_id}" if requisito.alcance == Alcance.SERVICIO else "entidad"
    )
    return (
        f"{mandante_id}/{empresa_id}/{segmento_alcance}/"
        f"{entidad_tipo.lower()}/{entidad_id}/{requisito.codigo}/"
        f"v{numero_version}/{uuid.uuid4().hex}.{ext}"
    )


def subir_archivos(
    requisito: RequisitoDocumental,
    archivos: list[ArchivoEntrada],
    mandante_id: uuid.UUID,
    empresa_id: uuid.UUID,
    entidad_tipo: str,
    entidad_id: uuid.UUID,
    numero_version: int,
    servicio_id: uuid.UUID | None,
) -> list[ArchivoValidado]:
    """
    Valida la entrega y sube los archivos a storage en orden.
    El storage es inmutable: nunca sobrescribe (cada key incluye un uuid).
    Se llama ANTES del commit de BD — un archivo huérfano en storage es
    barato; una fila apuntando a un archivo inexistente es un bug visible.
    """
    validar_entrega(requisito, archivos)
    storage = get_storage()

    resultado: list[ArchivoValidado] = []
    for orden, a in enumerate(archivos):
        key = construir_key(
            requisito, mandante_id, empresa_id, entidad_tipo, entidad_id,
            numero_version, a.nombre_original, servicio_id,
        )
        # El storage local/S3 genera su propio nombre único a partir de la carpeta;
        # separamos carpeta y nombre desde la key determinística.
        carpeta, nombre = key.rsplit("/", 1)
        subido = storage.subir(a.contenido, nombre, carpeta)
        resultado.append(ArchivoValidado(
            storage_key=subido.url,
            nombre_original=a.nombre_original,
            mime_type=a.mime_type,
            tamaño_bytes=len(a.contenido),
            hash_sha256=hashlib.sha256(a.contenido).hexdigest(),
            orden=orden,
        ))
    return resultado


def url_descarga(storage_key: str, expira_en_segundos: int = 3600) -> str:
    """URL firmada temporal — la key interna nunca se expone al frontend."""
    return get_storage().obtener_url_firmada(storage_key, expira_en_segundos)


def descargar(storage_key: str) -> bytes:
    return get_storage().descargar(storage_key)
