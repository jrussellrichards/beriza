export type EstadoGlobal = "PENDIENTE" | "ACREDITADA" | "EN_PROCESO" | "BLOQUEADA"

/** Cómo va el contratista con UN cliente. Fila del dashboard. */
export interface ResumenMandante {
  mandante_id: string
  mandante_razon_social: string
  estado_global: EstadoGlobal
  servicios_activos: number
  brechas: string[]
  trabajadores_total: number
  trabajadores_ok: number
}

/** Cómo juzga un mandante concreto un documento. */
export interface EstadoPorMandante {
  mandante_id: string
  mandante_razon_social: string
  estado: number | null
  mensaje_brecha: string | null
  documento_id: string | null
  /** Versión que ESTE mandante tiene fijada. Dos mandantes pueden diferir:
   *  el pin es explícito, subir una v2 no mueve al que ya aprobó la v1. */
  numero_version: number | null
  fecha_vigencia_hasta: string | null
}

/** Un documento del contratista con el estado de cada mandante que lo exige. */
export interface DocumentoContratista {
  clave: string
  /** null = exigido pero aún sin subir. */
  expediente_id: string | null
  /** Sensibilidad efectiva: la decisión del contratista o el default del catálogo. */
  sensible: boolean
  /** Decisión del contratista; null = usar el default de BERISA. */
  sensible_override: boolean | null
  /** false en documentos de trabajador: son datos personales de un tercero. */
  puede_relajar: boolean
  requisito_id: string
  requisito_codigo: string
  requisito_nombre: string
  /** Qué es el documento y qué debe contener, según el catálogo. */
  requisito_descripcion: string
  entidad_tipo: "EMPRESA" | "TRABAJADOR"
  alcance: "ENTIDAD" | "SERVICIO"
  max_archivos: number
  /** MIME aceptados, ya resueltos por el backend contra el default global. */
  formatos_permitidos: string[]
  pilar_codigo: string | null
  pilar_nombre: string | null
  trabajador_id: string | null
  trabajador_nombre: string | null
  servicio_id: string | null
  servicio_nombre: string | null
  mandantes: EstadoPorMandante[]
}


// ── Portal v2 ────────────────────────────────────────────────────────────────

/**
 * ¿Este documento está en regla? Lo está solo si TODOS los mandantes que lo
 * exigen lo tienen aprobado y vigente.
 *
 * Basta un cliente que lo haya observado, o una vigencia ya pasada, para que el
 * contratista no pueda trabajar — así que un "al día" que promedie entre
 * clientes mentiría justo donde importa. El estado 4 es APROBADO (ver
 * `domain/estados.py`).
 */
export function documentoAlDia(d: DocumentoContratista, hoy = new Date()): boolean {
  if (d.mandantes.length === 0) return false
  return d.mandantes.every(m => {
    if (m.estado !== 4) return false
    if (!m.fecha_vigencia_hasta) return true
    return new Date(m.fecha_vigencia_hasta) >= hoy
  })
}

export type TipoPendiente =
  | "AUTORIZACION" | "OBSERVADO" | "POR_VENCER" | "TRABAJADOR_INCOMPLETO"

/** Algo que el contratista debe resolver. Enunciado por su consecuencia. */
export interface Pendiente {
  tipo: TipoPendiente
  titulo: string
  detalle: string | null
  urgencia: number
  documento_id: string | null
  trabajador_id: string | null
  servicio_id: string | null
  requisito_id: string | null
  requisito_codigo: string | null
}

export interface HabilitacionServicio {
  servicio_id: string
  servicio_nombre: string
  mandante_razon_social: string
  /** Dónde queda esa faena. null en servicios anteriores a los centros. */
  centro_trabajo_nombre: string | null
  habilitado: boolean
  faltantes: string[]
}

/** Un trabajador con su habilitación en cada servicio donde está asignado. */
export interface TrabajadorHabilitacion {
  trabajador_id: string
  nombre_completo: string
  rut: string
  cargo: string | null
  activo: boolean
  servicios: HabilitacionServicio[]
}

export interface ServicioContratista {
  id: string
  nombre: string
  codigo_referencia: string | null
  estado: string
  fecha_inicio: string
  fecha_termino: string | null
  mandante_id: string
  mandante_razon_social: string
  perfil_nombre: string
  trabajadores_asignados: number
}

// ── Portal del mandante ──────────────────────────────────────────────────────

export interface ServicioEnRiesgo {
  servicio_id: string
  servicio_nombre: string
  contratista_razon_social: string
  trabajadores_asignados: number
  trabajadores_no_habilitados: number
  documentos_pendientes: number
  brechas_empresa: string[]
}

/** Dónde está expuesto el mandante, por faena. */
export interface RiesgoMandante {
  total_servicios: number
  servicios_en_riesgo: number
  personas_no_habilitadas: number
  documentos_por_revisar: number
  servicios: ServicioEnRiesgo[]
}
