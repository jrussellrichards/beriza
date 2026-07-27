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
    # Los datos de la organización solo viajan cuando la invitación es de tipo
    # ORGANIZACION. Un miembro del equipo NO los manda —y si los mandara, el
    # backend los ignora— porque no le corresponde editar el RUT de su empresa.
    razon_social: str | None = None
    rut: str | None = None
    giro: str | None = None
    # Un miembro del equipo puede corregir su propio nombre al activar.
    nombre: str | None = None


class InvitacionInfoResponse(BaseModel):
    email: str
    nombre: str
    # ORGANIZACION: el invitado ES la empresa que se está dando de alta y debe
    # confirmar sus datos (BERISA invita a un mandante, un mandante invita a un
    # contratista).
    # EQUIPO: el invitado se suma a una organización que YA existe. Sus datos ya
    # están definidos y no le corresponde editarlos.
    tipo: str
    # Nombre de la organización a la que se suma o que representa.
    organizacion: str
    razon_social: str
    rut: str
    giro: str | None = None
    # Quién invita. Vacío cuando BERISA invita a un mandante: no hay un tercero
    # por encima, y el frontend usa esto para cambiar el copy.
    mandante_razon_social: str
    rol: str = "contratista_admin"


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


class FilaErrorResponse(BaseModel):
    """Una fila que no se pudo cargar, con el motivo exacto."""
    fila: int
    rut: str
    nombre: str
    motivo: str


class ReporteImportacionResponse(BaseModel):
    """
    Resultado de una carga masiva de nómina.

    `cargados`, `ya_existian` y `con_error` suman `filas_leidas`. Se separan
    "ya existían" de "con error" porque volver a subir el mismo archivo con tres
    filas corregidas es el caso normal, no una falla.
    """
    filas_leidas: int
    cargados: int
    ya_existian: int
    con_error: int
    errores: list[FilaErrorResponse]


class InvitarUsuarioMandanteRequest(BaseModel):
    """
    Un mandante invita a alguien de su organización a revisar documentos.

    `rol` responde si ADMINISTRA la cuenta (mandante_admin) o no (prevencionista).
    El ALCANCE de aprobación es una pregunta aparte: `aprueba_todo` o los pilares
    de `pilar_ids`. Antes iban juntas y para dar alcance total había que entregar
    la administración.
    """
    email: EmailStr
    nombre: str
    rol: str = "prevencionista"
    # Ignorado si el rol ya aprueba todo por definición.
    aprueba_todo: bool = False
    pilar_ids: list[uuid.UUID] = []
    # Etiqueta, no permiso: "Jefe de Terreno", "Gerente HSE".
    cargo: str | None = None


class DefinirPermisosRequest(BaseModel):
    """Reemplaza el alcance de aprobación de este usuario."""
    pilar_ids: list[uuid.UUID] = []
    # Aprueba cualquier pilar sin administrar la cuenta. Si viene en True, los
    # pilar_ids se descartan (ver permiso_service.definir_permisos).
    aprueba_todo: bool = False


class UsuarioMandanteResponse(BaseModel):
    id: uuid.UUID
    email: str
    nombre: str
    rol: str
    activo: bool
    # None = aprueba todos los pilares (por rol o por aprueba_todo)
    pilares: list[str] | None
    pilar_ids: list[uuid.UUID]
    # Se expone para distinguir "aprueba todo porque administra" de "aprueba todo
    # y no administra": en la lista del equipo son dos cosas muy distintas.
    aprueba_todo: bool
    cargo: str | None


class InvitarMandanteRequest(BaseModel):
    """BERISA invita a un mandante nuevo. El slug se deriva de la razón social
    si no se indica; el mandante completa el resto al activar su cuenta."""
    email: EmailStr
    razon_social: str
    rut: str
    slug: str | None = None
    plan: str = "Pro"


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
    sin_vencimiento: bool = False
    sensible: bool = False


class ActualizarRequisitoCatalogoRequest(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    alcance: str | None = None
    max_archivos: int | None = None
    sin_vencimiento: bool | None = None
    sensible: bool | None = None


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

class CentroTrabajoRequest(BaseModel):
    """Alta o edición de un centro de trabajo."""
    nombre: str
    direccion: str | None = None
    # Debe ser un usuario del equipo del mandante; se valida en el dominio.
    encargado_id: uuid.UUID | None = None
    # Solo para editar: distingue "deja el encargado como está" (encargado_id
    # ausente) de "deja el cargo vacante". Sin esto no se puede desasignar.
    limpiar_encargado: bool = False


class CentroTrabajoResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    direccion: str | None
    encargado_id: uuid.UUID | None
    encargado_nombre: str | None
    activo: bool
    # Cuántos servicios vigentes hay ahí. Es lo que responde "¿puedo cerrarlo?".
    servicios_activos: int


class CrearServicioRequest(BaseModel):
    contratista_id: uuid.UUID
    perfil_requisitos_id: uuid.UUID
    nombre: str
    # Dónde se ejecuta. Obligatorio para servicios nuevos: el objetivo del
    # cambio es que a partir de ahora ninguno nazca sin lugar. Los que ya
    # existían quedan con null y se asignan desde la ficha del servicio.
    centro_trabajo_id: uuid.UUID
    tipo: str = "SERVICIO"  # OBRA | FAENA | SERVICIO
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
    tipo: str
    codigo_referencia: str | None
    descripcion: str | None
    fecha_inicio: date
    fecha_termino: date | None
    estado: str

    model_config = {"from_attributes": True}


class ActualizarServicioRequest(BaseModel):
    """
    Edición parcial: solo viajan los campos a cambiar.

    No incluye contratista ni perfil de requisitos a propósito — ver el docstring
    de `servicio_service.actualizar_servicio`. Cambiar el perfil alteraría en
    silencio qué documentos se exigen y podría deshabilitar trabajadores sin que
    nadie tocara un documento.
    """
    centro_trabajo_id: uuid.UUID | None = None
    nombre: str | None = None
    codigo_referencia: str | None = None
    descripcion: str | None = None
    fecha_termino: date | None = None


class ServicioListItemResponse(BaseModel):
    """Item del listado de servicios, enriquecido con contratista y perfil."""
    id: uuid.UUID
    nombre: str
    tipo: str
    codigo_referencia: str | None
    estado: str
    fecha_inicio: date
    fecha_termino: date | None
    contratista_id: uuid.UUID
    contratista_razon_social: str
    contratista_rut: str
    # El contratista necesita saber DE QUE CLIENTE es cada servicio; antes solo
    # se le mandaba su propia razon social, que para el es inutil.
    mandante_id: uuid.UUID
    mandante_razon_social: str
    perfil_nombre: str
    trabajadores_asignados: int
    # Dónde se ejecuta. None en los servicios creados antes de que existieran
    # los centros; la UI los marca como "sin asignar" para que se completen.
    centro_trabajo_id: uuid.UUID | None = None
    centro_trabajo_nombre: str | None = None


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
    pilar_id: uuid.UUID
    pilar_nombre: str
    contratista_razon_social: str
    trabajador_nombre: str | None
    servicio_nombre: str | None
    numero_version: int
    subido_en: datetime
    archivos: list[ArchivoDocumentoResponse]
    # Si ESTE usuario puede resolver esta entrega. Lo decide el backend y no el
    # frontend recalculando permisos: la autoridad sobre autorización es una
    # sola. Sirve para no ofrecer un botón que va a devolver 403.
    puede_aprobar: bool


class UrlDescargaResponse(BaseModel):
    url: str
    expira_en_segundos: int = 3600


class ResumenMandanteResponse(BaseModel):
    """Cómo va el contratista con UN cliente. Fila del dashboard."""
    mandante_id: uuid.UUID
    mandante_razon_social: str
    estado_global: str
    servicios_activos: int
    brechas: list[str]
    trabajadores_total: int
    trabajadores_ok: int

    model_config = {"from_attributes": True}


class HabilitacionServicioResponse(BaseModel):
    servicio_id: uuid.UUID
    servicio_nombre: str
    servicio_tipo: str
    mandante_razon_social: str
    habilitado: bool
    faltantes: list[str]

    model_config = {"from_attributes": True}


class TrabajadorHabilitacionResponse(BaseModel):
    """Un trabajador con su habilitación en cada servicio donde está asignado."""
    trabajador_id: uuid.UUID
    nombre_completo: str
    rut: str
    cargo: str | None
    activo: bool
    servicios: list[HabilitacionServicioResponse]

    model_config = {"from_attributes": True}


class ServicioEnRiesgoResponse(BaseModel):
    servicio_id: uuid.UUID
    servicio_nombre: str
    servicio_tipo: str
    contratista_razon_social: str
    trabajadores_asignados: int
    trabajadores_no_habilitados: int
    documentos_pendientes: int
    brechas_empresa: list[str]

    model_config = {"from_attributes": True}


class RiesgoMandanteResponse(BaseModel):
    """Donde esta expuesto el mandante, por faena."""
    total_servicios: int
    servicios_en_riesgo: int
    personas_no_habilitadas: int
    documentos_por_revisar: int
    servicios: list[ServicioEnRiesgoResponse]

    model_config = {"from_attributes": True}


class PendienteResponse(BaseModel):
    """Algo que el contratista debe resolver. La UI interpreta `tipo`."""
    tipo: str
    titulo: str
    detalle: str | None
    urgencia: int
    documento_id: uuid.UUID | None
    trabajador_id: uuid.UUID | None
    servicio_id: uuid.UUID | None
    requisito_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class EstadoPorMandanteResponse(BaseModel):
    """Cómo juzga un mandante concreto un documento del contratista."""
    mandante_id: uuid.UUID
    mandante_razon_social: str
    estado: int | None
    mensaje_brecha: str | None
    documento_id: uuid.UUID | None
    numero_version: int | None
    fecha_vigencia_hasta: date | None


class DocumentoContratistaResponse(BaseModel):
    """Un documento del contratista con el estado de cada mandante que lo exige."""
    clave: str
    expediente_id: uuid.UUID | None
    sensible: bool
    sensible_override: bool | None
    puede_relajar: bool
    requisito_id: uuid.UUID
    requisito_codigo: str
    requisito_nombre: str
    entidad_tipo: str
    alcance: str
    max_archivos: int
    pilar_codigo: str | None
    pilar_nombre: str | None
    trabajador_id: uuid.UUID | None
    trabajador_nombre: str | None
    servicio_id: uuid.UUID | None
    servicio_nombre: str | None
    mandantes: list[EstadoPorMandanteResponse]

    model_config = {"from_attributes": True}


class DefinirSensibilidadRequest(BaseModel):
    """None = usar el default del catálogo; True = endurecer; False = relajar."""
    sensible: bool | None = None


class SolicitudAutorizacionResponse(BaseModel):
    """Documento sensible que un mandante nuevo quiere ver por reutilización."""
    acreditacion_id: uuid.UUID
    mandante_razon_social: str
    requisito_codigo: str
    requisito_nombre: str
    pilar_nombre: str
    trabajador_nombre: str | None
    numero_version_vigente: int | None
    fecha_vigencia_hasta: date | None
    solicitado_en: datetime


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
