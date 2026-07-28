"use client"

import { useEffect, useState } from "react"
import { MapPin, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"

interface CentroTrabajo {
  id: string
  nombre: string
  direccion: string | null
}

/**
 * Asigna o cambia el centro de trabajo de un servicio que ya existe.
 *
 * Existe porque los servicios creados antes de que hubiera centros mostraban
 * "Sin centro asignado" y no ofrecían ninguna forma de arreglarlo: una pantalla
 * que señala un problema y no da salida es peor que no señalarlo.
 *
 * Solo lista centros ACTIVOS: el backend rechaza mover un servicio a uno
 * cerrado, y ofrecerlo sería un error garantizado al guardar.
 */
export function AsignarCentroDialog({ servicioId, servicioNombre, centroActualId, onClose, onGuardado }: {
  servicioId: string
  servicioNombre: string
  centroActualId: string | null
  onClose: () => void
  onGuardado: () => void
}) {
  const [centros, setCentros] = useState<CentroTrabajo[]>([])
  const [centroId, setCentroId] = useState(centroActualId ?? "")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<CentroTrabajo[]>("/api/v1/centros-trabajo/")
      .then(setCentros)
      .catch(() => setCentros([]))
  }, [])

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await api.patch(`/api/v1/servicios/${servicioId}`, { centro_trabajo_id: centroId })
      onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-surface-inverse/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-line-subtle flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {centroActualId ? "Cambiar centro de trabajo" : "Asignar centro de trabajo"}
            </p>
            <p className="text-xs text-ink-subtle mt-0.5 truncate">{servicioNombre}</p>
          </div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted shrink-0"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <label className="text-sm font-medium text-ink-secondary">¿Dónde se ejecuta?</label>
          <select
            value={centroId}
            onChange={e => setCentroId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="" disabled>Selecciona un centro...</option>
            {centros.map(c => (
              <option key={c.id} value={c.id}>
                {c.nombre}{c.direccion ? ` — ${c.direccion}` : ""}
              </option>
            ))}
          </select>

          {centros.length === 0 && (
            <p className="text-[11px] text-accion-ink">
              No hay centros en operación. Créalos primero en la sección Centros.
            </p>
          )}
          {error && <p className="text-sm text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-line-subtle">
          <button
            onClick={guardar}
            disabled={!centroId || centroId === centroActualId || guardando}
            className={cn(
              "w-full py-2.5 rounded-lg text-sm font-medium transition-all inline-flex items-center justify-center gap-2",
              !centroId || centroId === centroActualId || guardando
                ? "bg-line text-ink-subtle cursor-not-allowed"
                : "bg-surface-inverse text-white hover:bg-surface-inverse-hover",
            )}
          >
            <MapPin size={14} />
            {guardando ? "Guardando..." : "Guardar centro"}
          </button>
        </div>
      </div>
    </div>
  )
}
