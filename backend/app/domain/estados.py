"""
Enums y máquina de estados del dominio.

Única fuente de verdad para estados, alcances y tipos de evento.
Ningún otro módulo debe usar números (estado=1) ni strings ("ACTIVO")
mágicos — siempre importar desde aquí.
"""
from enum import IntEnum, StrEnum

from app.core.exceptions import EstadoDocumentoInvalido


class EstadoDocumento(IntEnum):
    """Ciclo de vida de una entrega documental."""
    ENVIADO = 1       # lo asigna el contratista al subir
    EN_ANALISIS = 2   # lo asigna el sistema al encolar el pipeline IA
    OBSERVADO = 3     # lo asigna el sistema IA con el mensaje exacto de brecha
    APROBADO = 4      # lo asigna el sistema IA o el mandante (excepción manual)


# Transiciones permitidas del ciclo: 1 → 2 → 4 (pipeline IA) | 1 → 3/4 (revisión
# manual del mandante cuando no hay LLM configurado) | 3 → 1 (corrección)
TRANSICIONES_VALIDAS: dict[EstadoDocumento, frozenset[EstadoDocumento]] = {
    EstadoDocumento.ENVIADO: frozenset({
        EstadoDocumento.EN_ANALISIS,   # pipeline IA
        EstadoDocumento.OBSERVADO,     # revisión manual del mandante
        EstadoDocumento.APROBADO,      # revisión manual del mandante
    }),
    EstadoDocumento.EN_ANALISIS: frozenset({EstadoDocumento.OBSERVADO, EstadoDocumento.APROBADO}),
    # Desde OBSERVADO: re-subida (nueva versión → ENVIADO) o aprobación por excepción del mandante
    EstadoDocumento.OBSERVADO: frozenset({EstadoDocumento.ENVIADO, EstadoDocumento.APROBADO}),
    # Desde APROBADO: renovación por vencimiento (nueva versión → ENVIADO)
    EstadoDocumento.APROBADO: frozenset({EstadoDocumento.ENVIADO}),
}


def validar_transicion(desde: EstadoDocumento, hacia: EstadoDocumento) -> None:
    """Lanza EstadoDocumentoInvalido si la transición no está permitida."""
    if hacia not in TRANSICIONES_VALIDAS[EstadoDocumento(desde)]:
        raise EstadoDocumentoInvalido(
            f"Transición de estado inválida: {EstadoDocumento(desde).name} -> {EstadoDocumento(hacia).name}"
        )


class EstadoServicio(StrEnum):
    """Ciclo de vida de un servicio (contrato mandante ↔ contratista)."""
    ACTIVO = "ACTIVO"
    SUSPENDIDO = "SUSPENDIDO"
    TERMINADO = "TERMINADO"


class EstadoAcreditacion(StrEnum):
    """Estado agregado de la relación contratista ↔ mandante."""
    PENDIENTE = "PENDIENTE"
    EN_PROCESO = "EN_PROCESO"
    ACREDITADA = "ACREDITADA"
    BLOQUEADA = "BLOQUEADA"


class EntidadTipo(StrEnum):
    """A quién aplica un requisito documental."""
    EMPRESA = "EMPRESA"
    TRABAJADOR = "TRABAJADOR"


class Alcance(StrEnum):
    """
    Ámbito de validez de un requisito documental:
    - ENTIDAD: se acredita una vez y vale para todos los servicios
      del mandante (ej: F30, carnet, escritura de la sociedad).
    - SERVICIO: se acredita por cada servicio contratado
      (ej: MIPER de la faena, contrato por obra).
    """
    ENTIDAD = "ENTIDAD"
    SERVICIO = "SERVICIO"


class TipoEvento(StrEnum):
    """Tipos de evento en la bitácora append-only de documentos."""
    SUBIDA = "SUBIDA"
    CAMBIO_ESTADO = "CAMBIO_ESTADO"
    REVISION_MANUAL = "REVISION_MANUAL"
    EXCEPCION_APROBADA = "EXCEPCION_APROBADA"
    ELIMINACION = "ELIMINACION"
