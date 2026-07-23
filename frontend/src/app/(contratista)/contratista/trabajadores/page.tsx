"use client"

import { useEffect, useState } from "react"
import { Briefcase, UserPlus, CheckCircle2, XCircle, UserX, UserCheck } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { AgregarTrabajadorDialog } from "@/features/agregar-trabajador/agregar-trabajador-dialog"
import { useTrabajadores } from "@/entities/trabajador/use-trabajadores"
import { getSession } from "@/shared/lib/auth"
import { api } from "@/shared/lib/api"
import type { Servicio } from "@/entities/servicio/types"
import type { Trabajador } from "@/shared/types"

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

/** trabajador_id → nombres de los servicios activos donde está asignado */
function useServiciosPorTrabajador() {
  const [mapa, setMapa] = useState<Record<string, string[]>>({})

  useEffect(() => {
    api.get<Servicio[]>("/api/v1/servicios/")
      .then(async (servicios) => {
        const activos = servicios.filter(s => s.estado === "ACTIVO")
        const porTrabajador: Record<string, string[]> = {}
        await Promise.all(activos.map(async (s) => {
          const ts = await api.get<{ id: string }[]>(`/api/v1/servicios/${s.id}/trabajadores`)
          for (const t of ts) {
            porTrabajador[t.id] = [...(porTrabajador[t.id] ?? []), s.nombre]
          }
        }))
        setMapa(porTrabajador)
      })
      .catch(() => setMapa({}))
  }, [])

  return mapa
}

export default function TrabajadoresPage() {
  const [session, setSession] = useState<{ contratista_id: string; rol: string } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cambiandoId, setCambiandoId] = useState<string | null>(null)

  useEffect(() => {
    const s = getSession()
    if (s) setSession(s)
  }, [])

  const { data: trabajadores, loading, error, refetch } = useTrabajadores(session?.contratista_id ?? "")
  const serviciosPor = useServiciosPorTrabajador()
  const isLoading = loading
  const puedeGestionarEstado = session?.rol === "contratista_admin"

  async function toggleActivo(t: Trabajador) {
    if (t.activo) {
      const servicios = serviciosPor[t.id] ?? []
      const aviso = servicios.length > 0
        ? `${t.nombre_completo} está asignado a ${servicios.length} servicio${servicios.length !== 1 ? "s" : ""} activo${servicios.length !== 1 ? "s" : ""} (${servicios.join(", ")}). ¿Desactivar de todas formas?`
        : `¿Desactivar a ${t.nombre_completo}?`
      if (!window.confirm(aviso)) return
    } else {
      if (!window.confirm(`¿Reactivar a ${t.nombre_completo}?`)) return
    }
    setCambiandoId(t.id)
    try {
      await api.patch(`/api/v1/trabajadores/${t.id}/${t.activo ? "desactivar" : "reactivar"}`, {})
      refetch()
    } catch {
      // el error queda implícito: el estado no cambia y el usuario puede reintentar
    } finally {
      setCambiandoId(null)
    }
  }

  const activos = trabajadores.filter(t => t.activo).length

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Trabajadores</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {activos} activo{activos !== 1 ? "s" : ""} de {trabajadores.length} registrado{trabajadores.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <UserPlus size={15} />
            Agregar trabajador
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : trabajadores.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
            <UserPlus size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-4">No hay trabajadores registrados</p>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 mx-auto bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <UserPlus size={14} />
              Agregar el primero
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">RUT</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Servicios asignados</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  {puedeGestionarEstado && (
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trabajadores.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {initials(t.nombre_completo)}
                        </div>
                        <span className="font-medium text-slate-900">{t.nombre_completo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{t.rut}</td>
                    <td className="px-4 py-3.5 text-slate-500">{t.cargo ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(serviciosPor[t.id] ?? []).map(nombre => (
                          <span key={nombre} className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                            <Briefcase size={9} /> {nombre}
                          </span>
                        ))}
                        {(serviciosPor[t.id] ?? []).length === 0 && (
                          <span className="text-xs text-slate-300">Sin asignar</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium",
                        t.activo ? "text-emerald-700" : "text-slate-400"
                      )}>
                        {t.activo
                          ? <CheckCircle2 size={13} className="text-emerald-500" />
                          : <XCircle size={13} className="text-slate-300" />
                        }
                        {t.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    {puedeGestionarEstado && (
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => toggleActivo(t)}
                          disabled={cambiandoId === t.id}
                          title={t.activo ? "Desactivar trabajador" : "Reactivar trabajador"}
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50",
                            t.activo
                              ? "border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                              : "border-slate-200 text-slate-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600"
                          )}
                        >
                          {t.activo ? <UserX size={12} /> : <UserCheck size={12} />}
                          {t.activo ? "Desactivar" : "Reactivar"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-400">{trabajadores.length} trabajador{trabajadores.length !== 1 ? "es" : ""}</p>
            </div>
          </div>
        )}
      </div>

      <AgregarTrabajadorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={refetch}
      />
    </div>
  )
}
