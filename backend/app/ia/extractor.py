from pydantic import BaseModel
from app.ia.schemas import SCHEMAS_POR_REQUISITO
from app.core.exceptions import ExcepcionExtraccion


def extraer_campos(
    imagenes: list[bytes],
    requisito_codigo: str,
) -> BaseModel:
    """
    Envía las imágenes del PDF al Vision LLM con un prompt estructurado
    y fuerza la respuesta al schema Pydantic del requisito correspondiente.
    Si el LLM no puede extraer un campo requerido, lanza ExcepcionExtraccion
    — nunca retorna datos parciales silenciosos.
    Precondición: requisito_codigo debe existir en SCHEMAS_POR_REQUISITO.
    """
    ...


def _construir_prompt(requisito_codigo: str, schema: type[BaseModel]) -> str:
    """
    Construye el prompt para el Vision LLM indicando qué campos extraer
    y en qué formato JSON devolverlos, según el tipo de documento.
    """
    ...


def _llamar_vision_llm(imagenes: list[bytes], prompt: str) -> str:
    """
    Llama a la API del Vision LLM (modelo configurado en .env).
    Retorna el texto crudo de la respuesta.
    """
    ...


def _parsear_respuesta(respuesta: str, schema: type[BaseModel]) -> BaseModel:
    """
    Parsea el JSON de la respuesta del LLM y lo valida con Pydantic.
    Si la validación falla, lanza ExcepcionExtraccion con el detalle del error.
    """
    ...
