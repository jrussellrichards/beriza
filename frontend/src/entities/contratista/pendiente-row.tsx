"use client"

import { useState } from "react"
import { AlertCircle, Clock, Lock, UserX } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import type { Pendiente, TipoPendiente } from "@/entities/contratista/resumen"

const ICONO: Record<TipoPendiente, { icon: typeof Lock; color: string }> = {
  AUTORIZACION:          { icon: Lock,        color: "text-excepcion-ink" },
  OBSERVADO:             { icon: AlertCircle, color: "text-bloqueo-ink" },
  POR_VENCER:            { icon: Clock,       color: "text-accion-ink" },
  TRABAJADOR_INCOMPLETO: { icon: UserX,       color: "text-ink-muted" },
}

/**
 * Una fila de la bandeja de pendientes.
 *
 * Las autorizaciones se resuelven aquí mismo: hacer navegar al contratista a
 * otra pantalla para apretar "autorizar" es fricción sin motivo. El resto
 * navega, porque subir un documento sí necesita su propia pantalla.
 */
export function PendienteRow({ p, onResuelto }: {
  p: Pendiente
  onResuelto: () => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { icon: Icono, color } = ICONO[p.tipo] ?? ICONO.OBSERVADO

  async function resolver(accion: "autorizar" | "rechazar") {
    setOcupado(true)
    setError(null)
    try {
      await api.post(`/api/v1/reutilizacion/solicitudes/${p.documento_id}/${accion}`, {})
      onResuelto()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo resolver")
      setOcupado(false)
    }
  }

  function irA() {
    if (p.tipo === "TRABAJADOR_INCOMPLETO") window.location.href = "/contratista/trabajadores"
    else window.location.href = "/contratista/documentos"
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-line-subtle last:border-0">
      <Icono size={17} className={cn("shrink-0", color)} />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink">{p.titulo}</p>
        {p.detalle && <p className="text-xs text-ink-subtle mt-0.5">{p.detalle}</p>}
        {error && <p className="text-xs text-bloqueo-ink mt-1">{error}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {p.tipo === "AUTORIZACION" ? (
          <>
            <button
              onClick={() => resolver("rechazar")}
              disabled={ocupado}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-ink-muted hover:bg-surface-app disabled:opacity-50 transition-colors"
            >
              Rechazar
            </button>
            <button
              onClick={() => resolver("autorizar")}
              disabled={ocupado}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-inverse text-white hover:bg-surface-inverse-hover disabled:opacity-50 transition-colors"
            >
              Autorizar
            </button>
          </>
        ) : (
          <button
            onClick={irA}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-ink-muted hover:bg-surface-app transition-colors"
          >
            {p.tipo === "OBSERVADO" ? "Subir corrección"
              : p.tipo === "POR_VENCER" ? "Renovar"
              : "Ver ficha"}
          </button>
        )}
      </div>
    </div>
  )
}
