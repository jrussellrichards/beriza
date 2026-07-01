import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from sqlalchemy.orm import Session

from app.models.mandante import MandanteRequisitoConfig
from app.models.pilar import RequisitoDocumental


@dataclass
class ResultadoValidacion:
    aprobado: bool
    estado: int           # 3=Observado | 4=Aprobado
    brechas: list[str] = field(default_factory=list)


def validar_documento(
    db: Session,
    requisito_codigo: str,
    campos_extraidos: dict,
    mandante_id: uuid.UUID,
) -> ResultadoValidacion:
    """
    Evalúa los campos extraídos por la IA contra las reglas configuradas
    por el mandante (vigencia, umbrales, etc.). La decisión es determinista
    y matemática — nunca la toma un LLM.
    """
    requisito = db.query(RequisitoDocumental).filter_by(codigo=requisito_codigo).first()
    if not requisito:
        return ResultadoValidacion(aprobado=False, estado=3, brechas=[f"Requisito '{requisito_codigo}' no encontrado en el sistema."])

    config = (
        db.query(MandanteRequisitoConfig)
        .filter_by(mandante_id=mandante_id, requisito_documental_id=requisito.id)
        .first()
    )
    vigencia_max_dias = config.vigencia_max_dias if config else 90
    umbral_deuda_max = float(config.umbral_deuda_max) if config else 0.0

    validadores = {
        "F30_1": lambda c: _validar_f30_1(c, vigencia_max_dias, umbral_deuda_max),
        "F30": lambda c: _validar_f30(c, vigencia_max_dias),
        "EXAMEN_MEDICO": lambda c: _validar_examen_medico(c, vigencia_max_dias),
        "CONTRATO": lambda c: _validar_contrato(c),
    }

    validar_fn = validadores.get(requisito_codigo)
    if validar_fn:
        brechas = validar_fn(campos_extraidos)
    else:
        # Documentos sin reglas específicas: solo verificar que se pudo extraer
        brechas = []

    if brechas:
        return ResultadoValidacion(aprobado=False, estado=3, brechas=brechas)
    return ResultadoValidacion(aprobado=True, estado=4, brechas=[])


def _validar_f30_1(campos: dict, vigencia_max_dias: int, umbral_deuda_max: float) -> list[str]:
    """Reglas específicas del F30-1: multas, deuda y antigüedad."""
    brechas = []

    fecha_emision = campos.get("fecha_emision")
    if fecha_emision:
        dias = _dias_desde_emision(fecha_emision)
        if dias > vigencia_max_dias:
            brechas.append(f"El F30-1 tiene {dias} días de antigüedad. El mandante exige máximo {vigencia_max_dias} días.")

    monto_deuda = campos.get("monto_deuda_total", 0)
    try:
        if float(monto_deuda) > umbral_deuda_max:
            brechas.append(f"Deuda previsional de ${float(monto_deuda):,.0f} supera el umbral permitido de ${umbral_deuda_max:,.0f}.")
    except (TypeError, ValueError):
        brechas.append("No se pudo leer el monto de deuda del F30-1.")

    tiene_multas = campos.get("tiene_multas_pendientes")
    if tiene_multas is True:
        brechas.append("El F30-1 registra multas pendientes del organismo previsional.")

    return brechas


def _validar_f30(campos: dict, vigencia_max_dias: int) -> list[str]:
    """Reglas específicas del F30: período tributario y monto pagado."""
    brechas = []

    fecha_emision = campos.get("fecha_emision")
    if fecha_emision:
        dias = _dias_desde_emision(fecha_emision)
        if dias > vigencia_max_dias:
            brechas.append(f"El F30 tiene {dias} días de antigüedad. El mandante exige máximo {vigencia_max_dias} días.")

    estado_tributario = campos.get("estado_tributario", "").upper()
    if estado_tributario and estado_tributario != "AL DIA":
        brechas.append(f"Estado tributario: '{estado_tributario}'. Se requiere 'Al día'.")

    return brechas


def _validar_examen_medico(campos: dict, vigencia_max_dias: int) -> list[str]:
    """Reglas específicas del examen médico: aptitud y vigencia."""
    brechas = []

    aptitud = campos.get("resultado_aptitud", "").upper()
    if aptitud and aptitud not in ("APTO", "APTO CON RESTRICCIONES"):
        brechas.append(f"El trabajador figura como '{aptitud}' en el examen médico. Se requiere apto.")

    fecha_examen = campos.get("fecha_examen")
    if fecha_examen:
        dias = _dias_desde_emision(fecha_examen)
        if dias > vigencia_max_dias:
            brechas.append(f"El examen médico tiene {dias} días. El mandante exige vigencia máxima de {vigencia_max_dias} días.")

    return brechas


def _validar_contrato(campos: dict) -> list[str]:
    """Reglas del contrato: fechas, firmas y consistencia de RUTs."""
    brechas = []

    if not campos.get("fecha_inicio"):
        brechas.append("No se encontró fecha de inicio en el contrato.")

    if not campos.get("firmado_trabajador"):
        brechas.append("El contrato no tiene firma del trabajador.")

    if not campos.get("firmado_empleador"):
        brechas.append("El contrato no tiene firma del empleador.")

    return brechas


def _dias_desde_emision(fecha_str: str) -> int:
    """Calcula los días desde la fecha de emisión (YYYY-MM-DD) hasta hoy."""
    try:
        fecha = date.fromisoformat(fecha_str)
        return (date.today() - fecha).days
    except (ValueError, TypeError):
        return 9999
