import { cn } from "@/shared/lib/utils"

/**
 * Indicador de cumplimiento X/Y: cuántos de los exigidos están en regla.
 *
 * Existe porque había NUEVE formas distintas del mismo dato repartidas por la
 * app —"2/3", "2 de 3", "{ok}/{total} exigidos", "{a} de {b} documentos
 * aprobados"— cada una con su propio formato y su propio color. Es el mismo
 * problema que tenían los estados antes de `estado-badge`: sin un lugar
 * canónico, la décima aparece sola.
 *
 * Un conteo suelto ("3 documentos") responde *¿cuántos tengo?*. El contratista
 * y el mandante preguntan otra cosa: *¿estoy en regla?*. Solo la razón responde
 * eso, y por eso reemplaza al conteo y no lo acompaña.
 *
 * El color: completo en verde, todo lo demás neutro. Pintar de ámbar lo
 * incompleto sería pintar de ámbar la pantalla entera el día 1 —cuando por
 * definición no hay nada aprobado— y matar la señal justo donde se necesita.
 * Es el mismo razonamiento por el que FALTA no lleva relleno en `estado-badge`.
 */
export function Ratio({ n, total, etiqueta, className }: {
  /** Cuántos están en regla. */
  n: number
  /** Cuántos se exigen. */
  total: number
  /** Texto tras la razón, p. ej. "al día". */
  etiqueta?: string
  className?: string
}) {
  // Sin exigencias no hay razón que mostrar: "0/0" se lee como un problema
  // cuando en realidad no hay nada que cumplir.
  if (total === 0) {
    return <span className={cn("text-micro text-ink-subtle", className)}>sin exigencias</span>
  }

  const completo = n >= total
  return (
    <span
      className={cn("inline-flex items-baseline gap-1 text-micro", className)}
      // El lector de pantalla oye la frase, no "dos barra tres".
      aria-label={`${n} de ${total}${etiqueta ? ` ${etiqueta}` : ""}`}
    >
      <span className={cn(
        "font-medium tabular-nums",
        completo ? "text-ok-ink" : "text-ink-secondary",
      )}>
        <span aria-hidden>{n}/{total}</span>
      </span>
      {etiqueta && <span className="text-ink-subtle" aria-hidden>{etiqueta}</span>}
    </span>
  )
}
