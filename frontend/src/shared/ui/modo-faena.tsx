"use client"

import { useEffect, useState } from "react"
import { Sun } from "lucide-react"
import { cn } from "@/shared/lib/utils"

const CLAVE = "modo-faena"

/**
 * Interruptor del modo faena: alto contraste para mirar el teléfono al aire libre.
 *
 * Se recuerda por dispositivo y no por cuenta a propósito. La misma persona usa
 * el escritorio de la oficina y el teléfono en obra, y lo que decide si hace
 * falta no es quién eres sino dónde estás parado.
 *
 * Va en `localStorage` y se aplica en un efecto: sin sesión, sin viaje al
 * servidor y sin bloquear el primer render.
 */
export function ModoFaena({ contexto = "claro" }: { contexto?: "claro" | "oscuro" }) {
  const [activo, setActivo] = useState(false)

  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE) === "1"
    setActivo(guardado)
    document.documentElement.dataset.modo = guardado ? "faena" : ""
  }, [])

  function alternar() {
    const nuevo = !activo
    setActivo(nuevo)
    localStorage.setItem(CLAVE, nuevo ? "1" : "0")
    document.documentElement.dataset.modo = nuevo ? "faena" : ""
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={activo}
      title={activo
        ? "Modo faena activo: alto contraste para el sol. Tócalo para volver al normal."
        : "Modo faena: sube el contraste para mirar la pantalla al aire libre."}
      className={cn(
        "inline-flex items-center justify-center rounded-lg p-2 transition-colors",
        activo
          ? "bg-accion-solid text-accion-on-solid"
          : contexto === "oscuro"
            ? "text-ink-inverse-muted hover:text-ink-inverse"
            : "text-ink-muted hover:text-ink",
      )}
    >
      <Sun size={16} />
      <span className="sr-only">
        {activo ? "Desactivar modo faena" : "Activar modo faena"}
      </span>
    </button>
  )
}
