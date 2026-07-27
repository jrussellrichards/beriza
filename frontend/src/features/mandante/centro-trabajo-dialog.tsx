"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { getSession } from "@/shared/lib/auth"

export interface CentroTrabajo {
  id: string
  nombre: string
  direccion: string | null
  encargado_id: string | null
  encargado_nombre: string | null
  activo: boolean
  servicios_activos: number
}

interface UsuarioEquipo {
  id: string
  nombre: string
  email: string
  activo: boolean
}

/**
 * Alta y edición de un centro de trabajo.
 *
 * El encargado se elige de una lista y no se escribe a mano: tiene que ser un
 * usuario del equipo del mandante. El backend lo valida igual —dejar como
 * responsable a alguien de otra empresa sería una fuga, porque el encargado se
 * muestra en las pantallas del centro— pero ofrecer un campo libre invitaría a
 * un error que después hay que explicar.
 */
export function CentroTrabajoDialog({ centro, onClose, onGuardado }: {
  /** null = crear uno nuevo */
  centro: CentroTrabajo | null
  onClose: () => void
  onGuardado: () => void
}) {
  const editando = centro !== null
  const [nombre, setNombre] = useState(centro?.nombre ?? "")
  const [direccion, setDireccion] = useState(centro?.direccion ?? "")
  const [encargadoId, setEncargadoId] = useState(centro?.encargado_id ?? "")
  const [equipo, setEquipo] = useState<UsuarioEquipo[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const s = getSession()
    if (!s?.mandante_id) return
    api.get<UsuarioEquipo[]>(`/api/v1/mandantes/${s.mandante_id}/usuarios`)
      .then(u => setEquipo(u.filter(x => x.activo)))
      .catch(() => setEquipo([]))
  }, [])

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const cuerpo = {
        nombre,
        direccion: direccion.trim() || null,
        encargado_id: encargadoId || null,
        // Vaciar el cargo tiene que ser explícito: sin este flag, el backend no
        // distingue "no lo toques" de "déjalo vacante".
        limpiar_encargado: editando && !encargadoId,
      }
      if (editando) await api.put(`/api/v1/centros-trabajo/${centro.id}`, cuerpo)
      else await api.post("/api/v1/centros-trabajo/", cuerpo)
      onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setGuardando(false)
    }
  }

  async function cerrar() {
    setGuardando(true)
    setError(null)
    try {
      await api.delete(`/api/v1/centros-trabajo/${centro!.id}`)
      onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar el centro")
    } finally {
      setGuardando(false)
    }
  }

  const inputCls = "w-full px-3 py-2.5 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-slate-900/10"

  return (
    <div className="fixed inset-0 bg-surface-inverse/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-line-subtle flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">
              {editando ? "Editar centro de trabajo" : "Nuevo centro de trabajo"}
            </p>
            <p className="text-xs text-ink-subtle mt-0.5">
              El lugar donde se ejecutan los servicios
            </p>
          </div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-secondary">Nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
                   placeholder="Chuquicamata" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-secondary">
              Dirección <span className="font-normal text-ink-subtle">(opcional)</span>
            </label>
            <input value={direccion} onChange={e => setDireccion(e.target.value)}
                   placeholder="Calama, Región de Antofagasta" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-secondary">Encargado</label>
            <select
              value={encargadoId}
              onChange={e => setEncargadoId(e.target.value)}
              className={inputCls}
            >
              <option value="">Sin asignar</option>
              {equipo.map(u => (
                <option key={u.id} value={u.id}>{u.nombre} — {u.email}</option>
              ))}
            </select>
            <p className="text-[10px] text-ink-subtle">
              Debe ser alguien de tu equipo. Si no está en la lista, invítalo primero
              desde Equipo.
            </p>
          </div>

          {error && <p className="text-sm text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}

          {editando && centro.activo && (
            <div className="pt-2 border-t border-line-subtle space-y-1.5">
              <button
                onClick={cerrar}
                disabled={guardando || centro.servicios_activos > 0}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
                  centro.servicios_activos > 0
                    ? "border-line text-ink-subtle cursor-not-allowed"
                    : "border-bloqueo-line text-bloqueo-ink hover:bg-bloqueo-soft",
                )}
              >
                Cerrar este centro
              </button>
              <p className="text-[10px] text-ink-subtle">
                {centro.servicios_activos > 0
                  ? `No se puede cerrar: tiene ${centro.servicios_activos} servicio(s) en curso.`
                  : "No se borra. Deja de ofrecerse al crear servicios, pero conserva su historial."}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line-subtle">
          <button
            onClick={guardar}
            disabled={!nombre.trim() || guardando}
            className={cn(
              "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
              !nombre.trim() || guardando
                ? "bg-line text-ink-subtle cursor-not-allowed"
                : "bg-surface-inverse text-white hover:bg-surface-inverse-hover",
            )}
          >
            {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear centro"}
          </button>
        </div>
      </div>
    </div>
  )
}
