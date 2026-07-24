export type EstadoDoc = "APROBADO" | "EN_ANALISIS" | "OBSERVADO" | "ENVIADO" | "VENCIDO" | "PENDIENTE_AUTORIZACION" | "FALTA"

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

export const ESTADO_NUM: Record<number, EstadoDoc> = { 1: "ENVIADO", 2: "EN_ANALISIS", 3: "OBSERVADO", 4: "APROBADO", 5: "VENCIDO", 6: "PENDIENTE_AUTORIZACION" }
export const estadoDe = (e: Exigencia): EstadoDoc => (e.estado ? ESTADO_NUM[e.estado] ?? "FALTA" : "FALTA")

export const ESTADO_CFG: Record<EstadoDoc, { label: string; dot: string; text: string; bg: string; border: string }> = {
  APROBADO:    { label: "Aprobado",    dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  EN_ANALISIS: { label: "En análisis", dot: "bg-blue-400",    text: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  OBSERVADO:   { label: "Observado",   dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200" },
  ENVIADO:     { label: "En revisión", dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  VENCIDO:     { label: "Vencido",     dot: "bg-orange-500",  text: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200" },
  PENDIENTE_AUTORIZACION: { label: "Requiere autorización", dot: "bg-violet-400", text: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
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

/** Días que faltan para que caduque. Negativo si ya venció, null si no aplica. */
export function diasParaVencer(iso: string | null): number | null {
  if (!iso) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vence = new Date(iso)
  vence.setHours(0, 0, 0, 0)
  return Math.round((vence.getTime() - hoy.getTime()) / 86_400_000)
}

/**
 * Documentos aprobados que caducan dentro de `dias`, más urgente primero.
 * Los ya vencidos quedan fuera: el cron los pasa a VENCIDO y se muestran con su
 * propio badge, no como aviso preventivo.
 */
export function porVencer(items: Exigencia[], dias = 30): Exigencia[] {
  return items
    .filter(e => {
      if (e.estado !== 4) return false
      const d = diasParaVencer(e.fecha_vigencia_hasta)
      return d !== null && d >= 0 && d <= dias
    })
    .sort((a, b) =>
      (diasParaVencer(a.fecha_vigencia_hasta) ?? 0) - (diasParaVencer(b.fecha_vigencia_hasta) ?? 0)
    )
}
