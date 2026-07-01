"""Schemas Pydantic para request/response de los routers FastAPI."""
import uuid
from datetime import datetime, date
from pydantic import BaseModel, EmailStr


# ── Usuarios ────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    mandante_id: uuid.UUID | None = None
    contratista_id: uuid.UUID | None = None


class ActivarCuentaRequest(BaseModel):
    token: str
    password: str
    razon_social: str
    rut: str
    giro: str | None = None


class CrearUsuarioRequest(BaseModel):
    email: EmailStr
    nombre: str
    password: str
    rol: str  # mandante_admin | contratista_admin | prevencionista


class UsuarioResponse(BaseModel):
    id: uuid.UUID
    email: str
    nombre: str
    rol: str
    mandante_id: uuid.UUID | None
    contratista_id: uuid.UUID | None

    model_config = {"from_attributes": True}


# ── Mandantes ────────────────────────────────────────────────────────────────

class CrearMandanteRequest(BaseModel):
    razon_social: str
    rut: str
    slug: str


class MandanteResponse(BaseModel):
    id: uuid.UUID
    razon_social: str
    rut: str
    slug: str
    activo: bool

    model_config = {"from_attributes": True}


class InvitarContratistaRequest(BaseModel):
    email: EmailStr
    razon_social: str
    rut: str


class ConfigurarRequisitoRequest(BaseModel):
    requisito_documental_id: uuid.UUID
    es_obligatorio: bool = True
    vigencia_max_dias: int
    umbral_deuda_max: float = 0.0


# ── Trabajadores ─────────────────────────────────────────────────────────────

class AgregarTrabajadorRequest(BaseModel):
    rut: str
    nombre_completo: str
    cargo: str | None = None


class TrabajadorResponse(BaseModel):
    id: uuid.UUID
    rut: str
    nombre_completo: str
    cargo: str | None
    activo: bool

    model_config = {"from_attributes": True}


# ── Documentos ───────────────────────────────────────────────────────────────

class DocumentoResponse(BaseModel):
    id: uuid.UUID
    requisito_id: uuid.UUID
    estado: int
    mensaje_brecha: str | None
    campos_extraidos: dict | None
    fecha_vigencia_hasta: date | None
    aprobado_por_excepcion: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SubidaDocumentoResponse(BaseModel):
    documento_id: uuid.UUID
    mensaje: str


class UrlDescargaResponse(BaseModel):
    url: str
    expira_en_segundos: int = 3600


# ── Acreditación ─────────────────────────────────────────────────────────────

class EstadoPilarResponse(BaseModel):
    pilar_codigo: str
    pilar_nombre: str
    cumple: bool
    brechas: list[str]


class EstadoTrabajadorResponse(BaseModel):
    trabajador_id: uuid.UUID
    nombre: str
    rut: str
    cumple: bool
    pilares: list[EstadoPilarResponse]


class AcreditacionResponse(BaseModel):
    contratista_id: uuid.UUID
    mandante_id: uuid.UUID
    estado_global: str
    pilares_empresa: list[EstadoPilarResponse]
    trabajadores: list[EstadoTrabajadorResponse]
