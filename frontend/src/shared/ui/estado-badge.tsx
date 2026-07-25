import { AlertTriangle, Ban } from "lucide-react"
import { cn } from "@/shared/lib/utils"

/**
 * Estados de un documento tal como los expone el backend.
 * Espejo de `app/domain/estados.py:EstadoDocumento` más el caso "no subido".
 */
export type EstadoDoc =
  | "FALTA"
  | "ENVIADO"
  | "EN_ANALISIS"
  | "OBSERVADO"
  | "APROBADO"
  | "VENCIDO"
  | "PENDIENTE_AUTORIZACION"

/** Estado agregado de la relación contratista ↔ mandante. */
export type EstadoAgregado = "PENDIENTE" | "EN_PROCESO" | "ACREDITADA" | "BLOQUEADA"

/** Ciclo de vida de un servicio. */
export type EstadoServicio = "ACTIVO" | "SUSPENDIDO" | "TERMINADO"

export const ESTADO_NUM: Record<number, EstadoDoc> = {
  1: "ENVIADO",
  2: "EN_ANALISIS",
  3: "OBSERVADO",
  4: "APROBADO",
  5: "VENCIDO",
  6: "PENDIENTE_AUTORIZACION",
}

/**
 * Glifo del badge. La forma es un SEGUNDO CANAL además del color, obligatorio
 * en los dos estados críticos: bajo daltonismo rojo-verde —~8% de los hombres,
 * y esta base de usuarios es predominantemente masculina y de terreno— el ámbar
 * y el rojo convergen a marrón. En un producto de seguridad eso no es un
 * residual aceptable.
 */
type Glifo = "punto" | "alerta" | "bloqueo"

interface Estilo {
  label: string
  soft: string
  line: string
  ink: string
  dot: string
  glifo: Glifo
  /** El azul solo se permite como estado si está en movimiento: significa
   *  "el sistema está trabajando". Un badge azul quieto es un bug. */
  pulse?: boolean
}

/**
 * Única fuente de verdad del color de estado.
 *
 * El tipo `Record<EstadoDoc, Estilo>` es deliberado: si el backend agrega un
 * estado, el build ROMPE hasta que alguien decida su color aquí. Es lo que
 * impide que el próximo estado se pinte con un `bg-purple-100` un viernes.
 */
const ESTILO: Record<EstadoDoc, Estilo> = {
  // Exigido y sin subir. Es una AUSENCIA, no un estado: al día 1 un contratista
  // tiene 40 documentos así, y pintarlos de ámbar mataría el ámbar en la primera
  // pantalla. Sin relleno, borde dashed.
  FALTA: {
    label: "Falta subir",
    soft: "bg-transparent",
    line: "border-vacio-line border-dashed",
    ink: "text-vacio-ink",
    dot: "bg-vacio-ink",
    glifo: "punto",
  },
  // El contratista ya hizo su parte: es cola, no urgencia ni logro. Gastar color
  // aquí sería gastarlo en el estado más frecuente.
  ENVIADO: {
    label: "En revisión",
    soft: "bg-espera-soft",
    line: "border-espera-line",
    ink: "text-espera-ink",
    dot: "bg-espera-ink",
    glifo: "punto",
  },
  EN_ANALISIS: {
    label: "En análisis",
    soft: "bg-proceso-soft",
    line: "border-proceso-line",
    ink: "text-proceso-ink",
    dot: "bg-proceso-ink",
    glifo: "punto",
    pulse: true,
  },
  // Sale del ROJO a propósito. Observado es la iteración esperada del flujo
  // (1→2→3→1→2→4), corregible por el contratista, y no bloquea nada todavía.
  // Pintarlo rojo hacía el producto punitivo y desensibilizaba el rojo para
  // vencido, que es el único que sí bloquea.
  OBSERVADO: {
    label: "Observado",
    soft: "bg-accion-soft",
    line: "border-accion-line",
    ink: "text-accion-ink",
    dot: "bg-accion-ink",
    glifo: "alerta",
  },
  APROBADO: {
    label: "Aprobado",
    soft: "bg-ok-soft",
    line: "border-ok-line",
    ink: "text-ok-ink",
    dot: "bg-ok-ink",
    glifo: "punto",
  },
  // El único estado a nivel documento que merece rojo: la persona no puede
  // entrar a faena hoy.
  VENCIDO: {
    label: "Vencido",
    soft: "bg-bloqueo-soft",
    line: "border-bloqueo-line",
    ink: "text-bloqueo-ink",
    dot: "bg-bloqueo-ink",
    glifo: "bloqueo",
  },
  // Decisión discrecional del mandante: máximamente distinto de rojo/ámbar/
  // verde/azul, y comunica "esto salió del carril automático".
  PENDIENTE_AUTORIZACION: {
    label: "Requiere autorización",
    soft: "bg-excepcion-soft",
    line: "border-excepcion-line",
    ink: "text-excepcion-ink",
    dot: "bg-excepcion-ink",
    glifo: "punto",
  },
}

/** El badge agregado muestra el peor pilar. */
const ESTILO_AGREGADO: Record<EstadoAgregado, Estilo> = {
  ACREDITADA: { ...ESTILO.APROBADO, label: "Acreditada" },
  EN_PROCESO: { ...ESTILO.OBSERVADO, label: "En proceso", glifo: "punto" },
  BLOQUEADA: { ...ESTILO.VENCIDO, label: "Bloqueada" },
  PENDIENTE: { ...ESTILO.FALTA, label: "Pendiente" },
}

/**
 * Estado de un servicio. Ojo: acá el verde NO significa "cumple" sino "vigente",
 * y el neutro no es "esperando" sino "cerrado". Es un vocabulario distinto al de
 * documentos y por eso tiene su propio mapa en vez de reutilizar el otro.
 */
const ESTILO_SERVICIO: Record<EstadoServicio, Estilo> = {
  ACTIVO: { ...ESTILO.APROBADO, label: "Activo" },
  SUSPENDIDO: { ...ESTILO.OBSERVADO, label: "Suspendido", glifo: "punto" },
  TERMINADO: { ...ESTILO.ENVIADO, label: "Terminado" },
}

function Marca({ estilo }: { estilo: Estilo }) {
  if (estilo.glifo === "alerta") {
    return <AlertTriangle size={11} className="shrink-0" strokeWidth={2.5} />
  }
  if (estilo.glifo === "bloqueo") {
    return <Ban size={11} className="shrink-0" strokeWidth={2.5} />
  }
  return (
    <span
      className={cn(
        "w-1.5 h-1.5 rounded-full shrink-0",
        estilo.dot,
        estilo.pulse && "animate-pulse"
      )}
    />
  )
}

/**
 * Badge de estado. Único componente para las once vistas.
 *
 * El fondo suave es decoración, nunca la señal: bajo sol directo un `#FFFBEB`
 * sobre blanco (1.02:1) es invisible. La señal la llevan el glifo y el color del
 * texto, que sí tienen contraste real (todos los `ink` cumplen AA).
 *
 * La etiqueta de texto NUNCA es opcional: un punto suelto sin palabra al lado no
 * es accesible.
 */
export function EstadoBadge({
  estado,
  etiqueta,
  className,
}: {
  estado: EstadoDoc
  /** Reemplaza el texto por defecto, p. ej. "Aprobado · vence en 12 días". */
  etiqueta?: string
  className?: string
}) {
  const e = ESTILO[estado]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-micro",
        e.soft,
        e.line,
        e.ink,
        className
      )}
    >
      <Marca estilo={e} />
      {etiqueta ?? e.label}
    </span>
  )
}

export function EstadoAgregadoBadge({
  estado,
  className,
}: {
  estado: EstadoAgregado
  className?: string
}) {
  const e = ESTILO_AGREGADO[estado] ?? ESTILO_AGREGADO.PENDIENTE
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-micro",
        e.soft,
        e.line,
        e.ink,
        className
      )}
    >
      <Marca estilo={e} />
      {e.label}
    </span>
  )
}

export function EstadoServicioBadge({
  estado,
  className,
}: {
  estado: EstadoServicio
  className?: string
}) {
  const e = ESTILO_SERVICIO[estado] ?? ESTILO_SERVICIO.TERMINADO
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-micro",
        e.soft,
        e.line,
        e.ink,
        className
      )}
    >
      <Marca estilo={e} />
      {e.label}
    </span>
  )
}

/** Etiquetas de documento, para textos que no usan el badge (frases de brecha). */
export const LABEL_DOC: Record<EstadoDoc, string> = {
  FALTA: "Falta subir",
  ENVIADO: "En revisión",
  EN_ANALISIS: "En análisis",
  OBSERVADO: "Observado",
  APROBADO: "Aprobado",
  VENCIDO: "Vencido",
  PENDIENTE_AUTORIZACION: "Requiere autorización",
}

/** Traduce el estado numérico del backend. null = exigido y sin subir. */
export const estadoDocDe = (n: number | null): EstadoDoc =>
  n ? ESTADO_NUM[n] ?? "FALTA" : "FALTA"

/** Etiquetas legibles por estado, para textos de filtro y selectores. */
export const LABEL_SERVICIO: Record<EstadoServicio, string> = {
  ACTIVO: "Activo",
  SUSPENDIDO: "Suspendido",
  TERMINADO: "Terminado",
}

export const LABEL_AGREGADO: Record<EstadoAgregado, string> = {
  ACREDITADA: "Acreditada",
  EN_PROCESO: "En proceso",
  BLOQUEADA: "Bloqueada",
  PENDIENTE: "Pendiente",
}

/**
 * "Aprobado · vence en N días" no es un estado nuevo sino un MODIFICADOR de
 * aprobado, y es la alerta de mayor valor del producto. Devuelve el estado a
 * pintar y su etiqueta.
 */
export function estadoConVigencia(
  estado: EstadoDoc,
  diasParaVencer: number | null
): { estado: EstadoDoc; etiqueta?: string } {
  if (estado !== "APROBADO" || diasParaVencer === null || diasParaVencer > 30) {
    return { estado }
  }
  if (diasParaVencer < 0) return { estado: "VENCIDO" }
  const cuando =
    diasParaVencer === 0 ? "vence hoy" : diasParaVencer === 1 ? "vence en 1 día" : `vence en ${diasParaVencer} días`
  return { estado: "OBSERVADO", etiqueta: `Aprobado · ${cuando}` }
}

/** Estilos crudos, para cuando se necesita el matiz fuera de un badge
 *  (p. ej. el borde izquierdo de 3px de una fila de tabla). */
export function estiloDeEstado(estado: EstadoDoc): Estilo {
  return ESTILO[estado]
}
