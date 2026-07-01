from pydantic import BaseModel, field_validator
from datetime import date
from typing import Optional


class CamposF30_1(BaseModel):
    """Certificado de Antecedentes Laborales — Dirección del Trabajo."""
    rut_empresa: str
    numero_multas_vigentes: int
    tiene_multas_pendientes: bool
    monto_deuda_total: float
    fecha_emision: date


class CamposF30(BaseModel):
    """Declaración y Pago de Cotizaciones."""
    rut_empresa: str
    periodo_tributario: str     # formato YYYY-MM
    estado_tributario: str      # AL DIA | CON DEUDA
    total_imponible: float
    monto_pagado: float
    numero_trabajadores: int
    fecha_emision: date


class CamposContrato(BaseModel):
    """Contrato de Trabajo individual."""
    rut_trabajador: str
    rut_empleador: str
    fecha_inicio: date
    fecha_termino: Optional[date] = None    # None si es indefinido
    cargo: str
    firmado_trabajador: bool
    firmado_empleador: bool


class CamposLiquidacionSueldo(BaseModel):
    """Liquidación de sueldo del mes anterior."""
    rut_trabajador: str
    mes_liquidacion: str        # formato YYYY-MM
    sueldo_liquido: float
    firmado: bool


class CamposExamenMedico(BaseModel):
    """Examen de Aptitud Médica Ocupacional."""
    rut_trabajador: str
    tipo_examen: str            # ALTURA | ESPACIO_CONFINADO | GENERAL
    resultado_aptitud: str   # APTO | APTO CON RESTRICCIONES | NO APTO
    fecha_examen: date
    fecha_vigencia_hasta: date


class CamposDAS(BaseModel):
    """Derecho a Saber / Inducción de Riesgos."""
    rut_trabajador: str
    fecha_charla: date
    firmado_trabajador: bool


class CamposEPP(BaseModel):
    """Entrega de Elementos de Protección Personal."""
    rut_trabajador: str
    fecha_entrega: date
    detalle_equipos: list[str]
    firmado_trabajador: bool


class CamposMIPER(BaseModel):
    """Matriz de Identificación de Riesgos."""
    fecha_aprobacion: date
    codigo_proyecto: str
    firmado_experto: bool


class CamposRIOHS(BaseModel):
    """Reglamento Interno de Orden, Higiene y Seguridad."""
    rut_empresa: str
    fecha_deposito: date
    timbre_recepcion: bool


class CamposCarpetaTributaria(BaseModel):
    """Carpeta Tributaria Electrónica del SII."""
    rut_empresa: str
    codigo_verificacion: str
    patrimonio_neto: float
    fecha_emision: date


class CamposVigenciaSociedad(BaseModel):
    """Certificado de Vigencia de Sociedad."""
    razon_social: str
    rut_representante: str
    fecha_registro: date


class CamposDJConflicto(BaseModel):
    """Declaración Jurada de Conflicto de Interés."""
    rut_representante: str
    fecha_firma: date
    declara_no_conflicto: bool


# Mapa de código de requisito → schema Pydantic correspondiente
SCHEMAS_POR_REQUISITO: dict[str, type[BaseModel]] = {
    "F30_1":              CamposF30_1,
    "F30":                CamposF30,
    "CONTRATO":           CamposContrato,
    "LIQ_SUELDO":         CamposLiquidacionSueldo,
    "EXAM_MED":           CamposExamenMedico,
    "DAS":                CamposDAS,
    "EPP":                CamposEPP,
    "MIPER":              CamposMIPER,
    "RIOHS":              CamposRIOHS,
    "CARP_TRIB":          CamposCarpetaTributaria,
    "VIG_SOCIEDAD":       CamposVigenciaSociedad,
    "DJ_CONFLICTO":       CamposDJConflicto,
}
