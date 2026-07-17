"use client"

import { useCallback, useEffect, useState } from "react"
import { Briefcase, ChevronRight, Plus, UserMinus, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { getSession } from "@/shared/lib/auth"
import { AvancePanel } from "@/entities/servicio/avance-panel"
import type { EstadoServicio, Servicio } from "@/entities/servicio/types"

const ESTADO_CFG: Record<EstadoServicio, { label: string; dot: string; text: string; bg: string; border: string }> = {
  ACTIVO:     { label: "Activo",     dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  SUSPENDIDO: { label: "Suspendido", dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  TERMINADO:  { label: "Terminado",  dot: "bg-slate-400",   text: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200" },
}

function EstadoBadge({ estado }: { estado: EstadoServicio }) {
  const c = ESTADO_CFG[estado] ?? ESTADO_CFG.TERMINADO
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", c.bg, c.border, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  )
}

interface TrabajadorItem {
  id: string
  rut: string
  nombre_completo: string
  cargo: string | null
  activo: boolean
}

// ── Gestión de dotación ───────────────────────────────────────────────────────

function DotacionTab({ servicio, onCambio }: { servicio: Servicio; onCambio: () => void }) {
  const [asignados, setAsignados] = useState<TrabajadorItem[]>([])
  const [disponibles, setDisponibles] = useState<TrabajadorItem[]>([])
  const [seleccion, setSeleccion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(() => {
    const s = getSession()
    if (!s?.contratista_id) return
    Promise.all([
      api.get<TrabajadorItem[]>(`/api/v1/servicios/${servicio.id}/trabajadores`),
      api.get<TrabajadorItem[]>(`/api/v1/trabajadores/empresa/${s.contratista_id}`),
    ])
      .then(([asig, todos]) => {
        setAsignados(asig)
        const idsAsignados = new Set(asig.map((t) => t.id))
        setDisponibles(todos.filter((t) => !idsAsignados.has(t.id)))
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar dotación"))
  }, [servicio.id])

  useEffect(() => { cargar() }, [cargar])

  async function asignar() {
    if (!seleccion) return
    setCargando(true)
    setError(null)
    try {
      await api.post(`/api/v1/servicios/${servicio.id}/trabajadores`, { trabajador_id: seleccion })
      setSeleccion("")
      cargar()
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al asignar")
    } finally {
      setCargando(false)
    }
  }

  async function desasignar(trabajadorId: string) {
    setCargando(true)
    setError(null)
    try {
      await api.delete(`/api/v1/servicios/${servicio.id}/trabajadores/${trabajadorId}`)
      cargar()
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al desasignar")
    } finally {
      setCargando(false)
    }
  }

  const puedeEditar = servicio.estado === "ACTIVO"

  return (
    <div className="space-y-4">
      {puedeEditar ? (
        <div className="flex gap-2">
          <select
            value={seleccion}
            onChange={(e) => setSeleccion(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="" disabled>Agregar trabajador a la faena...</option>
            {disponibles.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre_completo} — {t.rut}</option>
            ))}
          </select>
          <button
            onClick={asignar}
            disabled={!seleccion || cargando}
            className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <Plus size={13} /> Asignar
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-md px-3 py-2">
          Solo se puede modificar la dotación de servicios activos.
        </p>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

      <div className="space-y-1.5">
        {asignados.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-800">{t.nombre_completo}</p>
              <p className="text-xs text-slate-400 font-mono">{t.rut}{t.cargo ? ` · ${t.cargo}` : ""}</p>
            </div>
            {puedeEditar && (
              <button
                onClick={() => desasignar(t.id)}
                disabled={cargando}
                title="Desasignar de la faena"
                className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
              >
                <UserMinus size={14} />
              </button>
            )}
          </div>
        ))}
        {asignados.length === 0 && (
          <p className="text-xs text-slate-400 italic px-1">Sin trabajadores asignados a esta faena</p>
        )}
      </div>
    </div>
  )
}

// ── Panel detalle ─────────────────────────────────────────────────────────────

function DetailPanel({ s, onClose, onCambio }: { s: Servicio; onClose: () => void; onCambio: () => void }) {
  const [tab, setTab] = useState<"avance" | "dotacion">("avance")
  // Forzar recarga del avance cuando cambia la dotación
  const [avanceKey, setAvanceKey] = useState(0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-0 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-tight">{s.nombre}</p>
            <p className="text-xs text-slate-400">
              {s.codigo_referencia ? `${s.codigo_referencia} · ` : ""}Perfil: {s.perfil_nombre}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={16} />
          </button>
        </div>
        <EstadoBadge estado={s.estado} />

        <div className="flex gap-0 mt-4 -mb-px">
          {([["avance", "Avance"], ["dotacion", "Dotación"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                tab === id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === "avance" && <AvancePanel key={avanceKey} servicioId={s.id} />}
        {tab === "dotacion" && (
          <DotacionTab servicio={s} onCambio={() => { setAvanceKey((k) => k + 1); onCambio() }} />
        )}
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ServiciosContratistaPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [seleccionado, setSeleccionado] = useState<Servicio | null>(null)

  const cargar = useCallback(() => {
    api.get<Servicio[]>("/api/v1/servicios/")
      .then(setServicios)
      .catch(() => setServicios([]))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", seleccionado ? "mr-96" : "")}>

        <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
          <h1 className="text-xl font-semibold text-slate-900">Mis servicios</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Faenas contratadas, su avance de acreditación y la dotación asignada
          </p>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Servicio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Perfil</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dotación</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Inicio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {servicios.map((s) => {
                  const selected = seleccionado?.id === s.id
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSeleccionado(selected ? null : s)}
                      className={cn("cursor-pointer transition-colors", selected ? "bg-slate-50" : "hover:bg-slate-50/70")}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                            <Briefcase size={13} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-[240px]">{s.nombre}</p>
                            {s.codigo_referencia && (
                              <p className="text-[10px] text-slate-400 font-mono">{s.codigo_referencia}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{s.perfil_nombre}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{s.trabajadores_asignados}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">{s.fecha_inicio}</td>
                      <td className="px-4 py-3.5"><EstadoBadge estado={s.estado} /></td>
                      <td className="px-4 py-3.5">
                        <ChevronRight size={14} className={cn("text-slate-300 transition-transform", selected && "rotate-90 text-slate-500")} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {servicios.length === 0 && (
              <div className="py-14 text-center">
                <p className="text-sm text-slate-400">Aún no tienes servicios contratados</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel lateral */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-20 transition-transform duration-300",
        seleccionado ? "translate-x-0" : "translate-x-full"
      )}>
        {seleccionado && (
          <DetailPanel s={seleccionado} onClose={() => setSeleccionado(null)} onCambio={cargar} />
        )}
      </div>
    </div>
  )
}
