export type EstadoDoc = "APROBADO" | "EN_ANALISIS" | "OBSERVADO" | "ENVIADO" | "FALTA"

export interface Exigencia {
  requisito_id: string
  requisito_codigo: string
  requisito_nombre: string
  entidad_tipo: "EMPRESA" | "TRABAJADOR"
  alcance: "ENTIDAD" | "SERVICIO"
  max_archivos: number
  estado: number | null
  fecha_vigencia_hasta: string | null
  mensaje_brecha: string | null
  documento_id: string | null
  trabajador_id: string | null
  trabajador_nombre: string | null
  servicio_id: string | null
  servicio_nombre: string | null
  pilar_codigo: string
  pilar_nombre: string
}

export const ESTADO_NUM: Record<number, EstadoDoc> = { 1: "ENVIADO", 2: "EN_ANALISIS", 3: "OBSERVADO", 4: "APROBADO" }
export const estadoDe = (e: Exigencia): EstadoDoc => (e.estado ? ESTADO_NUM[e.estado] ?? "FALTA" : "FALTA")

export const ESTADO_CFG: Record<EstadoDoc, { label: string; dot: string; text: string; bg: string; border: string }> = {
  APROBADO:    { label: "Aprobado",    dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  EN_ANALISIS: { label: "En análisis", dot: "bg-blue-400",    text: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  OBSERVADO:   { label: "Observado",   dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200" },
  ENVIADO:     { label: "En revisión", dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  FALTA:       { label: "Falta",       dot: "bg-slate-300",   text: "text-slate-500",   bg: "bg-slate-50",   border: "border-slate-200" },
}

export const PILAR_COLOR: Record<string, { border: string; bg: string; dot: string; text: string }> = {
  LEGAL:      { border: "border-blue-200",   bg: "bg-blue-50",   dot: "bg-blue-500",   text: "text-blue-700" },
  HSE:        { border: "border-amber-200",  bg: "bg-amber-50",  dot: "bg-amber-500",  text: "text-amber-700" },
  COMPLIANCE: { border: "border-purple-200", bg: "bg-purple-50", dot: "bg-purple-500", text: "text-purple-700" },
}
export const PILAR_DEFAULT = { border: "border-slate-200", bg: "bg-slate-50", dot: "bg-slate-500", text: "text-slate-700" }

export function formatFecha(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
}
