"use client"

import { useCallback, useEffect, useState } from "react"
import { Briefcase, ChevronRight, MapPin, Pause, Play, Plus, Search, Square, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { EstadoServicioBadge, LABEL_SERVICIO } from "@/shared/ui/estado-badge"
import { api } from "@/shared/lib/api"
import { AvancePanel } from "@/entities/servicio/avance-panel"
import type { EstadoServicio, Servicio } from "@/entities/servicio/types"
import { CrearServicioDialog } from "@/features/crear-servicio/crear-servicio-dialog"
import { AsignarCentroDialog } from "@/features/crear-servicio/asignar-centro-dialog"

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
  const [asignandoCentro, setAsignandoCentro] = useState(false)

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
      <div className="px-5 pt-5 pb-4 border-b border-line-subtle">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-sunken text-ink-muted text-[10px] font-bold flex items-center justify-center shrink-0">
              {initials(s.contratista_razon_social)}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink leading-tight">{s.nombre}</p>
              <p className="text-xs text-ink-subtle">{s.contratista_razon_social}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <EstadoServicioBadge estado={s.estado} />
          {s.codigo_referencia && (
            <span className="text-[10px] font-mono text-ink-subtle border border-line rounded px-1.5 py-0.5">
              {s.codigo_referencia}
            </span>
          )}
          <span className="text-[10px] text-ink-subtle">
            Perfil: <span className="font-medium text-ink-muted">{s.perfil_nombre}</span>
          </span>
          {/* Los servicios anteriores a los centros no tienen uno. Se marca en
              ámbar para que se completen, no en rojo: no bloquea nada. */}
          <button
            onClick={() => setAsignandoCentro(true)}
            title={s.centro_trabajo_nombre ? "Cambiar centro de trabajo" : "Asignar centro de trabajo"}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border transition-colors",
              s.centro_trabajo_nombre
                ? "text-ink-subtle border-line hover:bg-surface-app"
                : "text-accion-ink border-accion-line bg-accion-soft hover:bg-accion-soft",
            )}
          >
            <MapPin size={10} />
            {s.centro_trabajo_nombre ?? "Asignar centro"}
          </button>
        </div>

        {/* Acciones de estado */}
        {s.estado !== "TERMINADO" && (
          <div className="flex gap-2 mt-3">
            {s.estado === "ACTIVO" ? (
              <button
                onClick={() => cambiarEstado("SUSPENDIDO")}
                disabled={cambiando}
                className="flex items-center gap-1.5 text-xs font-medium text-accion-ink border border-accion-line bg-accion-soft hover:bg-accion-soft px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
              >
                <Pause size={11} /> Suspender
              </button>
            ) : (
              <button
                onClick={() => cambiarEstado("ACTIVO")}
                disabled={cambiando}
                className="flex items-center gap-1.5 text-xs font-medium text-ok-ink border border-ok-line bg-ok-soft hover:bg-ok-soft px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
              >
                <Play size={11} /> Reactivar
              </button>
            )}
            <button
              onClick={() => cambiarEstado("TERMINADO")}
              disabled={cambiando}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-muted border border-line bg-surface hover:bg-surface-app px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              <Square size={10} /> Terminar
            </button>
          </div>
        )}
        {error && <p className="text-xs text-bloqueo-ink mt-2">{error}</p>}
      </div>

      {/* Avance */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <AvancePanel servicioId={s.id} />
      </div>

      {asignandoCentro && (
        <AsignarCentroDialog
          servicioId={s.id}
          servicioNombre={s.nombre}
          centroActualId={s.centro_trabajo_id}
          onClose={() => setAsignandoCentro(false)}
          onGuardado={() => { setAsignandoCentro(false); onEstadoCambiado() }}
        />
      )}
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
    <div className="flex min-h-screen">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", seleccionado ? "lg:mr-96" : "")}>

        {/* Header */}
        <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-ink">Servicios</h1>
              <p className="text-sm text-ink-muted mt-0.5">Contratos y faenas con sus exigencias documentales</p>
            </div>
            <button
              onClick={() => setDialogAbierto(true)}
              className="flex items-center gap-2 bg-surface-inverse text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
            >
              <Plus size={15} />
              Nuevo servicio
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 sm:px-8 py-6 space-y-5">

          {/* KPI */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total", value: servicios.length, color: "text-ink" },
              { label: "Activos", value: kpi.activos, color: "text-ok-ink" },
              { label: "Suspendidos", value: kpi.suspendidos, color: "text-accion-ink" },
              { label: "Terminados", value: kpi.terminados, color: "text-ink-muted" },
            ].map((k) => (
              <div key={k.label} className="bg-surface rounded-xl border border-line px-5 py-4">
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">{k.label}</p>
                <p className={cn("text-3xl font-semibold mt-1", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                placeholder="Buscar servicio, empresa o N° contrato..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"
              />
            </div>
            <div className="flex items-center gap-1 bg-surface border border-line rounded-lg p-1">
              {(["TODOS", "ACTIVO", "SUSPENDIDO", "TERMINADO"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setFiltro(e)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    filtro === e ? "bg-surface-inverse text-white" : "text-ink-muted hover:text-ink"
                  )}
                >
                  {e === "TODOS" ? "Todos" : LABEL_SERVICIO[e] + "s"}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-subtle ml-auto">{filtrados.length} de {servicios.length}</p>
          </div>

          {/* Tabla */}
          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-subtle bg-surface-app/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Servicio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Contratista</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Perfil</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Dotación</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Inicio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtrados.map((s) => {
                  const selected = seleccionado?.id === s.id
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSeleccionado(selected ? null : s)}
                      className={cn("cursor-pointer transition-colors", selected ? "bg-surface-app" : "hover:bg-surface-app/70")}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-surface-sunken text-ink-muted flex items-center justify-center shrink-0">
                            <Briefcase size={13} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-ink truncate max-w-[200px]">{s.nombre}</p>
                            {s.codigo_referencia && (
                              <p className="text-[10px] text-ink-subtle font-mono">{s.codigo_referencia}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-ink-secondary truncate max-w-[200px]">{s.contratista_razon_social}</p>
                        <p className="text-[10px] text-ink-subtle font-mono">{s.contratista_rut}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-ink-muted">{s.perfil_nombre}</td>
                      <td className="px-4 py-3.5 text-xs text-ink-muted">{s.trabajadores_asignados}</td>
                      <td className="px-4 py-3.5 text-xs text-ink-subtle">{s.fecha_inicio}</td>
                      <td className="px-4 py-3.5"><EstadoServicioBadge estado={s.estado} /></td>
                      <td className="px-4 py-3.5">
                        <ChevronRight size={14} className={cn("text-ink-subtle transition-transform", selected && "rotate-90 text-ink-muted")} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filtrados.length === 0 && (
              <div className="py-14 text-center">
                <p className="text-sm text-ink-subtle">No se encontraron servicios</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel lateral */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-surface border-l border-line shadow-xl z-20 transition-transform duration-300",
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
