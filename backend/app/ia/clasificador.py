from dataclasses import dataclass


@dataclass
class ResultadoClasificacion:
    tipo_detectado: str     # código de requisito: F30_1 | CONTRATO | EXAM_MED | etc.
    confianza: float        # 0.0 a 1.0
    es_valido: bool         # False si confianza < 0.90 o tipo = DESCONOCIDO


UMBRAL_CONFIANZA = 0.90


def clasificar_documento(imagen_bytes: bytes, tipo_esperado: str) -> ResultadoClasificacion:
    """
    Recibe el PDF convertido a imagen y verifica visualmente que corresponde
    al tipo de documento esperado (evita fraude: subir un PDF en blanco como F30-1).
    Si la confianza es menor al 90%, retorna es_valido=False con tipo DESCONOCIDO.
    Precondición: imagen_bytes es la primera página del PDF en formato PNG/JPEG.
    """
    ...


def pdf_a_imagenes(pdf_bytes: bytes) -> list[bytes]:
    """
    Convierte cada página de un PDF a una imagen PNG.
    Retorna una lista donde el índice 0 es la primera página.
    """
    ...
