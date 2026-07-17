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


class ActualizarMandanteRequest(BaseModel):
    razon_social: str | None = None
    email_contacto: str | None = None
    sitio_web: str | None = None


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




# ── Catálogo global (solo berisa_admin) ─────────────────────────────────────

class CrearRequisitoCatalogoRequest(BaseModel):
    codigo: str
    nombre: str
    descripcion: str | None = None
    entidad_tipo: str  # EMPRESA | TRABAJADOR
    alcance: str = "ENTIDAD"  # ENTIDAD | SERVICIO
    max_archivos: int = 1


class ActualizarRequisitoCatalogoRequest(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    alcance: str | None = None
    max_archivos: int | None = None


# ── Perfiles de requisitos ───────────────────────────────────────────────────

class CrearPerfilRequest(BaseModel):
    nombre: str
    descripcion: str | None = None


class ConfigurarRequisitoPerfilRequest(BaseModel):
    requisito_documental_id: uuid.UUID
    es_obligatorio: bool = True
    vigencia_max_dias: int
    umbral_deuda_max: float = 0.0
    parametros_extra: dict | None = None


class PerfilResponse(BaseModel):
    id: uuid.UUID
    mandante_id: uuid.UUID
    nombre: str
    descripcion: str | None
    activo: bool

    model_config = {"from_attributes": True}


# ── Servicios ────────────────────────────────────────────────────────────────

class CrearServicioRequest(BaseModel):
    contratista_id: uuid.UUID
    perfil_requisitos_id: uuid.UUID
    nombre: str
    fecha_inicio: date
    codigo_referencia: str | None = None
    descripcion: str | None = None
    fecha_termino: date | None = None
    # Solo berisa_admin lo necesita; para mandante_admin se resuelve del JWT
    mandante_id: uuid.UUID | None = None


class ServicioResponse(BaseModel):
    id: uuid.UUID
    contratista_mandante_id: uuid.UUID
    perfil_requisitos_id: uuid.UUID
    nombre: str
    codigo_referencia: str | None
    descripcion: str | None
    fecha_inicio: date
    fecha_termino: date | None
    estado: str

    model_config = {"from_attributes": True}


class ServicioListItemResponse(BaseModel):
    """Item del listado de servicios, enriquecido con contratista y perfil."""
    id: uuid.UUID
    nombre: str
    codigo_referencia: str | None
    estado: str
    fecha_inicio: date
    fecha_termino: date | None
    contratista_id: uuid.UUID
    contratista_razon_social: str
    contratista_rut: str
    perfil_nombre: str
    trabajadores_asignados: int


class CambiarEstadoServicioRequest(BaseModel):
    estado: str  # ACTIVO | SUSPENDIDO | TERMINADO


class AsignarTrabajadorServicioRequest(BaseModel):
    trabajador_id: uuid.UUID


# ── Avance de servicio ───────────────────────────────────────────────────────

class RequisitoAvanceResponse(BaseModel):
    requisito_id: uuid.UUID
    requisito_codigo: str
    requisito_nombre: str
    entidad_tipo: str
    alcance: str
    estado: int | None
    fecha_vigencia_hasta: date | None
    mensaje_brecha: str | None
    documento_id: uuid.UUID | None
    trabajador_id: uuid.UUID | None
    trabajador_nombre: str | None
    servicio_id: uuid.UUID | None
    servicio_nombre: str | None
    pilar_codigo: str | None
    pilar_nombre: str | None
    max_archivos: int = 1

    model_config = {"from_attributes": True}


class PilarAvanceResponse(BaseModel):
    codigo: str
    nombre: str
    total: int
    aprobados: int
    cumple: bool
    requisitos: list[RequisitoAvanceResponse]

    model_config = {"from_attributes": True}


class TrabajadorAvanceResponse(BaseModel):
    trabajador_id: uuid.UUID
    nombre: str
    rut: str
    cargo: str | None
    total: int
    aprobados: int
    cumple: bool

    model_config = {"from_attributes": True}


class ResumenAvanceResponse(BaseModel):
    total_requisitos: int
    subidos: int
    aprobados: int
    observados: int
    en_analisis: int
    enviados: int
    faltantes: int
    porcentaje_avance: int

    model_config = {"from_attributes": True}


class AvanceServicioResponse(BaseModel):
    servicio_id: uuid.UUID
    resumen: ResumenAvanceResponse
    pilares: list[PilarAvanceResponse]
    trabajadores: list[TrabajadorAvanceResponse]

    model_config = {"from_attributes": True}


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

class ArchivoDocumentoResponse(BaseModel):
    id: uuid.UUID
    orden: int
    nombre_original: str
    mime_type: str
    tamaño_bytes: int

    model_config = {"from_attributes": True}


class DocumentoVersionResponse(BaseModel):
    id: uuid.UUID
    numero_version: int
    estado: int
    mensaje_brecha: str | None
    fecha_vigencia_hasta: date | None
    aprobado_por_excepcion: bool
    created_at: datetime
    archivos: list[ArchivoDocumentoResponse]

    model_config = {"from_attributes": True}


class DocumentoEventoResponse(BaseModel):
    tipo_evento: str
    estado_anterior: int | None
    estado_nuevo: int | None
    detalle: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentoResponse(BaseModel):
    id: uuid.UUID
    requisito_id: uuid.UUID
    servicio_id: uuid.UUID | None
    estado: int
    mensaje_brecha: str | None
    fecha_vigencia_hasta: date | None
    created_at: datetime
    version_vigente: DocumentoVersionResponse | None

    model_config = {"from_attributes": True}


class HistorialDocumentoResponse(BaseModel):
    documento_id: uuid.UUID
    versiones: list[DocumentoVersionResponse]
    eventos: list[DocumentoEventoResponse]


class SubidaDocumentoResponse(BaseModel):
    documento_id: uuid.UUID
    version_id: uuid.UUID
    numero_version: int
    mensaje: str


class RevisarDocumentoRequest(BaseModel):
    aprobar: bool
    mensaje_brecha: str | None = None
    fecha_vigencia_hasta: date | None = None


class PendienteRevisionResponse(BaseModel):
    documento_id: uuid.UUID
    requisito_codigo: str
    requisito_nombre: str
    pilar_nombre: str
    contratista_razon_social: str
    trabajador_nombre: str | None
    servicio_nombre: str | None
    numero_version: int
    subido_en: datetime
    archivos: list[ArchivoDocumentoResponse]


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
