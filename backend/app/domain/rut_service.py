"""
RUT chileno: normalización y validación del dígito verificador.

Vive en el dominio y no en un router porque identifica a la PERSONA a la que se
le atribuyen documentos de cumplimiento. Un RUT mal tipeado no es un error
cosmético: los certificados quedan colgando de alguien que no existe, y eso se
descubre el día de la fiscalización.

El dígito verificador es módulo 11 y detecta la mayoría de los errores de tipeo
—dígitos cambiados de lugar, un número mal— que es exactamente lo que produce
cargar una nómina de 80 filas a mano.
"""
import re

from sqlalchemy.orm import Session

from app.core.exceptions import RutInvalido

# Sin puntos ni guion, en mayúscula. Solo dígitos y una K final opcional.
_SOLO_RUT = re.compile(r"[^0-9kK]")


def _digito_verificador(numero: str) -> str:
    """Módulo 11 sobre el cuerpo del RUT, con los multiplicadores 2..7 cíclicos."""
    suma, multiplicador = 0, 2
    for caracter in reversed(numero):
        suma += int(caracter) * multiplicador
        multiplicador = 2 if multiplicador == 7 else multiplicador + 1
    resto = 11 - (suma % 11)
    return {11: "0", 10: "K"}.get(resto, str(resto))


def clave(rut: str) -> str:
    """
    Forma canónica para COMPARAR: solo dígitos y el verificador, sin puntos.

    Se usa para detectar duplicados. Sin esto "12.345.678-5" y "12345678-5" son
    dos trabajadores distintos, y una nómina cargada dos veces con distinto
    formato duplica a la gente en silencio.
    """
    return _SOLO_RUT.sub("", rut or "").upper()


def formatear(rut: str) -> str:
    """Formato de presentación 12.345.678-5, que es como se guarda en la app."""
    limpio = clave(rut)
    cuerpo, dv = limpio[:-1], limpio[-1]
    with_dots = ""
    for i, c in enumerate(reversed(cuerpo)):
        if i and i % 3 == 0:
            with_dots = "." + with_dots
        with_dots = c + with_dots
    return f"{with_dots}-{dv}"


def validar(rut: str) -> str:
    """
    Valida y devuelve el RUT formateado. Lanza `RutInvalido` con el motivo
    exacto, que es lo que el reporte de importación le muestra al usuario: decir
    "fila 34 inválida" sin decir por qué obliga a adivinar.
    """
    if not (rut or "").strip():
        raise RutInvalido("Falta el RUT")
    limpio = clave(rut)
    if not limpio:
        # La celda tenía algo pero no quedó ni un dígito. Decir "RUT vacío" acá
        # confunde: el usuario mira su planilla, ve texto en la celda, y cree que
        # el reporte se equivocó de fila.
        raise RutInvalido(f"'{rut}' no tiene el formato de un RUT")
    cuerpo, dv = limpio[:-1], limpio[-1]
    if not cuerpo.isdigit():
        raise RutInvalido(f"'{rut}' no tiene el formato de un RUT")
    if len(cuerpo) < 7:
        raise RutInvalido(f"'{rut}' es demasiado corto para ser un RUT")
    if len(cuerpo) > 8:
        raise RutInvalido(f"'{rut}' es demasiado largo para ser un RUT")
    esperado = _digito_verificador(cuerpo)
    if dv != esperado:
        raise RutInvalido(
            f"'{rut}' tiene el dígito verificador incorrecto (debería terminar en {esperado})"
        )
    return formatear(limpio)


def normalizar_en_tabla(db: Session, modelo, aplicar: bool) -> list[tuple[str, str, str]]:
    """
    Corrige el dígito verificador de los RUT ya guardados en una tabla.

    El NÚMERO no se toca, solo el dígito. Son datos de demostración y cambiar el
    cuerpo rompería cualquier captura o guion que ya los mencione.

    Vive acá y no en un script porque la llaman DOS: el seed —que debe hacerlo
    antes de buscar por RUT, o no encontraría lo que ya existe y crearía
    duplicados— y la limpieza de datos de prueba.

    Devuelve (nombre, actual, corregido) por fila cambiada; con `aplicar=False`
    solo informa.
    """
    cambios: list[tuple[str, str, str]] = []
    for fila in db.query(modelo).all():
        actual = (getattr(fila, "rut", None) or "").strip()
        limpio = clave(actual)
        # Menos de 8 caracteres no es un RUT con el dígito equivocado sino
        # basura; corregirlo inventaría una identidad que nadie tecleó.
        if len(limpio) < 8 or not limpio[:-1].isdigit():
            continue
        try:
            validar(actual)
            continue
        except RutInvalido:
            pass
        correcto = formatear(limpio[:-1] + _digito_verificador(limpio[:-1]))
        nombre = getattr(fila, "razon_social", None) or getattr(fila, "nombre_completo", "?")
        cambios.append((nombre, actual, correcto))
        if aplicar:
            fila.rut = correcto
    return cambios
