"use client"

import { useCallback, useEffect, useState } from "react"
import { Briefcase, ChevronRight, Pause, Play, Plus, Search, Square, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { AvancePanel } from "@/entities/servicio/avance-panel"
import type { EstadoServicio, Servicio } from "@/entities/servicio/types"
import { CrearServicioDialog } from "@/features/crear-servicio/crear-servicio-dialog"

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

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

// ── Panel detalle ─────────────────────────────────────────────────────────────

function DetailPanel({ s, onClose, onEstadoCambiado }: {
  s: Servicio
  onClose: () => void
  onEstadoCambiado: () => void
}) {
  const [cambiando, setCambiando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cambiarEstado(estado: EstadoServicio) {
    setCambiando(true)
    setError(null)
    try {
      await api.patch(`/api/v1/servicios/${s.id}/estado`, { estado })
      onEstadoCambiado()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar estado")
    } finally {
      setCambiando(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
              {initials(s.contratista_razon_social)}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-tight">{s.nombre}</p>
              <p className="text-xs text-slate-400">{s.contratista_razon_social}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <EstadoBadge estado={s.estado} />
          {s.codigo_referencia && (
            <span className="text-[10px] font-mono text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
              {s.codigo_referencia}
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            Perfil: <span className="font-medium text-slate-500">{s.perfil_nombre}</span>
          </span>
        </div>

        {/* Acciones de estado */}
        {s.estado !== "TERMINADO" && (
          <div className="flex gap-2 mt-3">
            {s.estado === "ACTIVO" ? (
              <button
                onClick={() => cambiarEstado("SUSPENDIDO")}
                disabled={cambiando}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
              >
                <Pause size={11} /> Suspender
              </button>
            ) : (
              <button
                onClick={() => cambiarEstado("ACTIVO")}
                disabled={cambiando}
                className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
              >
                <Play size={11} /> Reactivar
              </button>
            )}
            <button
              onClick={() => cambiarEstado("TERMINADO")}
              disabled={cambiando}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              <Square size={10} /> Terminar
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {/* Avance */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <AvancePanel servicioId={s.id} />
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<EstadoServicio | "TODOS">("TODOS")
  const [seleccionado, setSeleccionado] = useState<Servicio | null>(null)
  const [dialogAbierto, setDialogAbierto] = useState(false)

  const cargar = useCallback(() => {
    api.get<Servicio[]>("/api/v1/servicios/")
      .then((data) => {
        setServicios(data)
        // Mantener el panel sincronizado tras un cambio de estado
        setSeleccionado((sel) => (sel ? data.find((s) => s.id === sel.id) ?? null : null))
      })
      .catch(() => setServicios([]))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = servicios.filter((s) => {
    const q = busqueda.toLowerCase()
    const matchQ =
      s.nombre.toLowerCase().includes(q) ||
      s.contratista_razon_social.toLowerCase().includes(q) ||
      (s.codigo_referencia ?? "").toLowerCase().includes(q)
    const matchE = filtro === "TODOS" || s.estado === filtro
    return matchQ && matchE
  })

  const kpi = {
    activos: servicios.filter((s) => s.estado === "ACTIVO").length,
    suspendidos: servicios.filter((s) => s.estado === "SUSPENDIDO").length,
    terminados: servicios.filter((s) => s.estado === "TERMINADO").length,
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", seleccionado ? "mr-96" : "")}>

        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Servicios</h1>
              <p className="text-sm text-slate-500 mt-0.5">Contratos y faenas con sus exigencias documentales</p>
            </div>
            <button
              onClick={() => setDialogAbierto(true)}
              className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus size={15} />
              Nuevo servicio
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6 space-y-5">

          {/* KPI */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total", value: servicios.length, color: "text-slate-900" },
              { label: "Activos", value: kpi.activos, color: "text-emerald-600" },
              { label: "Suspendidos", value: kpi.suspendidos, color: "text-amber-600" },
              { label: "Terminados", value: kpi.terminados, color: "text-slate-500" },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
                <p className={cn("text-3xl font-semibold mt-1", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar servicio, empresa o N° contrato..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
              {(["TODOS", "ACTIVO", "SUSPENDIDO", "TERMINADO"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setFiltro(e)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    filtro === e ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  {e === "TODOS" ? "Todos" : ESTADO_CFG[e].label + "s"}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 ml-auto">{filtrados.length} de {servicios.length}</p>
          </div>

          {/* Tabla */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Servicio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contratista</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Perfil</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dotación</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Inicio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((s) => {
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
                            <p className="font-medium text-slate-900 truncate max-w-[200px]">{s.nombre}</p>
                            {s.codigo_referencia && (
                              <p className="text-[10px] text-slate-400 font-mono">{s.codigo_referencia}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-slate-700 truncate max-w-[200px]">{s.contratista_razon_social}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{s.contratista_rut}</p>
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

            {filtrados.length === 0 && (
              <div className="py-14 text-center">
                <p className="text-sm text-slate-400">No se encontraron servicios</p>
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
          <DetailPanel
            s={seleccionado}
            onClose={() => setSeleccionado(null)}
            onEstadoCambiado={cargar}
          />
        )}
      </div>

      <CrearServicioDialog
        open={dialogAbierto}
        onClose={() => setDialogAbierto(false)}
        onSuccess={cargar}
      />
    </div>
  )
}
