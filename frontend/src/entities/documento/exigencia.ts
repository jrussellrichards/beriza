export type EstadoDoc = "APROBADO" | "EN_ANALISIS" | "OBSERVADO" | "ENVIADO" | "VENCIDO" | "PENDIENTE_AUTORIZACION" | "FALTA"

export const ESTADO_NUM: Record<number, EstadoDoc> = { 1: "ENVIADO", 2: "EN_ANALISIS", 3: "OBSERVADO", 4: "APROBADO", 5: "VENCIDO", 6: "PENDIENTE_AUTORIZACION" }

/**
 * Agrupadores de pilar: NEUTROS a propósito.
 *
 * Antes HSE era ámbar y Compliance púrpura, que son los matices reservados a
 * "falta algo tuyo" y "excepción del mandante". Un encabezado de grupo compitiendo
 * con el vocabulario de estado impide que el ojo aprenda qué significa cada color.
 * El nombre del pilar ya lo identifica.
 */
export const PILAR_COLOR: Record<string, { border: string; bg: string; dot: string; text: string }> = {}
export const PILAR_DEFAULT = {
  border: "border-line",
  bg: "bg-surface-sunken",
  dot: "bg-ink-subtle",
  text: "text-ink-muted",
}

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
