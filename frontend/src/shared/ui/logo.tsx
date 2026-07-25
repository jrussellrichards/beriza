import { cn } from "@/shared/lib/utils"

/**
 * Marca de Acredita: una barrera de control de acceso a faena, levantada.
 *
 * Por qué no un escudo (que era el ícono genérico anterior): el escudo promete
 * protección legal que Acredita no puede dar, y es el cliché exacto del rubro —
 * los portales de acreditación chilenos están llenos de escudos y candados.
 *
 * La barrera es el objeto REAL de este negocio: todo el producto existe para que
 * esa pluma se levante o no. Y está levantada a propósito, no bajada: comunica
 * "puedes entrar", que es la postura del producto — se asume que el contratista
 * quiere cumplir, no que está evadiendo.
 *
 * Tres trazos, sin relleno: sobrevive a 16px como favicon, donde un escudo se
 * convierte en una manchita. La base es necesaria — sin ella el poste más la
 * diagonal se leen como un visto o una flecha.
 */
export function LogoAcredita({
  size = 28,
  className,
}: {
  size?: number
  className?: string
}) {
  // El trazo engrosa en tamaños chicos para que no desaparezca en el favicon.
  const grosor = size <= 20 ? 4.5 : size <= 32 ? 3.6 : 3.2

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Acredita"
    >
      {/* Base: ancla la figura y evita que se lea como un visto */}
      <path d="M5 41 H17" />
      {/* Poste */}
      <path d="M11 41 V20" />
      {/* Pluma levantada, pivotando en el extremo del poste */}
      <path d="M11 20 L41 8" />
    </svg>
  )
}

/**
 * Marca completa con el nombre.
 *
 * El lock-up con "de BERISA" no es decorativo: "Acredita" solo es un verbo
 * genérico y en Chile varios portales lo usan como descripción. BERISA es lo que
 * lo convierte en nombre propio.
 */
export function MarcaAcredita({
  contexto = "claro",
  subtitulo,
  className,
}: {
  contexto?: "claro" | "oscuro"
  /** Reemplaza "de BERISA", p. ej. "Portal Contratista" en el sidebar. */
  subtitulo?: string
  className?: string
}) {
  const enOscuro = contexto === "oscuro"

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoAcredita
        size={28}
        // El cobre es el color de marca, y solo vive en superficies de marca.
        // Sobre fondo oscuro no tiene contraste suficiente, así que ahí manda el
        // azul claro (9.36:1 contra el sidebar).
        className={enOscuro ? "text-brand-on-dark" : "text-brand-mark"}
      />
      <div>
        <p
          className={cn(
            "text-[19px] font-medium leading-none tracking-[-0.02em]",
            enOscuro ? "text-ink-inverse" : "text-ink"
          )}
        >
          Acredita
        </p>
        <p
          className={cn(
            "text-[10px] mt-1 tracking-[0.04em]",
            enOscuro ? "text-ink-inverse-muted" : "text-ink-subtle"
          )}
        >
          {subtitulo ?? "de BERISA"}
        </p>
      </div>
    </div>
  )
}
