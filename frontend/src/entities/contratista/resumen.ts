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
  entidad_tipo: "EMPRESA" | "TRABAJADOR"
  alcance: "ENTIDAD" | "SERVICIO"
  max_archivos: number
  pilar_codigo: string | null
  pilar_nombre: string | null
  trabajador_id: string | null
  trabajador_nombre: string | null
  servicio_id: string | null
  servicio_nombre: string | null
  mandantes: EstadoPorMandante[]
}

export const ESTADO_GLOBAL_CFG: Record<EstadoGlobal, {
  label: string; text: string; bg: string; border: string; dot: string
}> = {
  ACREDITADA: { label: "Acreditada", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  EN_PROCESO: { label: "En proceso", text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500" },
  BLOQUEADA:  { label: "Bloqueada",  text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500" },
  PENDIENTE:  { label: "Pendiente",  text: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200",   dot: "bg-slate-400" },
}
