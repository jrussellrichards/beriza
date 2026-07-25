"use client"

import { useState } from "react"
import { Check, Lock, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import type { EstadoPorMandante } from "@/entities/contratista/resumen"

/**
 * Resolver una solicitud de acceso a un documento sensible, desde la pantalla
 * donde el contratista está viendo el documento.
 *
 * Lo importante que comunica: autorizar comparte con **ese** cliente y nada más
 * — el documento sigue siendo sensible y el próximo cliente volverá a pedir
 * permiso. Sin decirlo, autorizar parece renunciar a la protección.
 */
export function ResolverSolicitudDialog({ mandante, requisitoNombre, onClose, onResuelto }: {
  mandante: EstadoPorMandante
  requisitoNombre: string
  onClose: () => void
  onResuelto: () => void
}) {
  const [ocupado, setOcupado] = useState<"autorizar" | "rechazar" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function resolver(accion: "autorizar" | "rechazar") {
    setOcupado(accion)
    setError(null)
    try {
      await api.post(`/api/v1/reutilizacion/solicitudes/${mandante.documento_id}/${accion}`, {})
      onResuelto()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo resolver")
      setOcupado(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-violet-600" />
          <p className="text-sm font-semibold text-slate-900">Solicitud de acceso</p>
        </div>

        <p className="text-sm text-slate-600 mt-3">
          <strong className="font-medium text-slate-900">{mandante.mandante_razon_social}</strong>{" "}
          quiere revisar tu <strong className="font-medium text-slate-900">{requisitoNombre.toLowerCase()}</strong>.
        </p>

        <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 space-y-1.5">
          <p className="text-[11px] text-slate-600">
            <strong className="font-medium">Si autorizas:</strong> solo este cliente lo verá. El documento
            sigue marcado como sensible, así que el próximo cliente que lo exija volverá a pedirte permiso.
          </p>
          <p className="text-[11px] text-slate-600">
            <strong className="font-medium">Si rechazas:</strong> el requisito quedará como brecha con este
            cliente hasta que le subas el documento aparte, y no se te volverá a preguntar.
          </p>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md mt-3">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => resolver("rechazar")}
            disabled={ocupado !== null}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium border transition-colors",
              ocupado ? "border-slate-200 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <X size={14} />
            {ocupado === "rechazar" ? "Rechazando..." : "Rechazar"}
          </button>
          <button
            onClick={() => resolver("autorizar")}
            disabled={ocupado !== null}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
              ocupado ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"
            )}
          >
            <Check size={14} />
            {ocupado === "autorizar" ? "Autorizando..." : "Autorizar"}
          </button>
        </div>

        <button onClick={onClose} className="w-full mt-3 py-1.5 text-xs text-slate-500 hover:text-slate-800">
          Decidir después
        </button>
      </div>
    </div>
  )
}
