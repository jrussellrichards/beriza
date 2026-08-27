"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Archive, ArchiveRestore, Briefcase, ChevronRight, MapPin, Pause, Pencil, Play, Plus,
  Search, Square, Trash2, X,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { EstadoServicioBadge, LABEL_SERVICIO } from "@/shared/ui/estado-badge"
import { api } from "@/shared/lib/api"
import { AvancePanel } from "@/entities/servicio/avance-panel"
import type { EstadoServicio, Servicio } from "@/entities/servicio/types"
import { CrearServicioDialog } from "@/features/crear-servicio/crear-servicio-dialog"
import { AsignarCentroDialog } from "@/features/crear-servicio/asignar-centro-dialog"
import { EditarServicioDialog } from "@/features/crear-servicio/editar-servicio-dialog"

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
  const [editando, setEditando] = useState(false)

  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  async function accion(cual: "archivar" | "desarchivar") {
    setCambiando(true)
    setError(null)
    try {
      await api.post(`/api/v1/servicios/${s.id}/${cual}`, {})
      onEstadoCambiado()
    } catch (e) {
      setError(e instanceof Error ? e.message : `No se pudo ${cual}`)
    } finally {
      setCambiando(false)
    }
  }

  async function eliminar() {
    setCambiando(true)
    setError(null)
    try {
      await api.delete(`/api/v1/servicios/${s.id}`)
      setConfirmandoBorrado(false)
      onClose()
      onEstadoCambiado()
    } catch (e) {
      // El backend responde 409 con el motivo exacto —cuántas asignaciones o
      // expedientes lo retienen— y la salida. Se muestra tal cual: es más útil
      // que "no se pudo eliminar".
      setError(e instanceof Error ? e.message : "No se pudo eliminar")
      setConfirmandoBorrado(false)
    } finally {
      setCambiando(false)
    }
  }

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
            <div className="w-8 h-8 rounded-lg bg-surface-sunken text-ink-muted text-[10px] font-semibold flex items-center justify-center shrink-0">
              {initials(s.contratista_razon_social)}
            </div>
            <div>
              <p className="text-strong font-semibold text-ink leading-tight">{s.nombre}</p>
              <p className="text-meta text-ink-subtle">{s.contratista_razon_social}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <EstadoServicioBadge estado={s.estado} />
          {s.archivado_en && (
            <span className="inline-flex items-center gap-1 text-[10px] text-ink-subtle border border-line rounded px-1.5 py-0.5">
              <Archive size={9} /> Archivado
            </span>
          )}
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

        {/* Acciones. Editar va aparte del bloque de estado a proposito: ese se
            oculta cuando el servicio esta TERMINADO, y corregir el nombre o el
            codigo de contrato de un servicio ya cerrado tiene que seguir siendo
            posible — es justo cuando alguien revisa y encuentra el error. */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 text-micro font-medium text-ink-muted border border-line bg-surface hover:bg-surface-app px-2.5 py-1.5 rounded-md transition-colors"
          >
            <Pencil size={11} /> Editar
          </button>

          {/* Archivar solo aparece si el servicio ya NO está activo. No es un
              detalle de interfaz: el backend lo rechaza, porque archivar algo
              activo lo sacaría de la evaluación y podría dejar acreditado a un
              contratista que no cumple. Acá se explica en vez de ofrecer un
              botón que va a fallar. */}
          {s.archivado_en ? (
            <button
              onClick={() => accion("desarchivar")}
              disabled={cambiando}
              className="flex items-center gap-1.5 text-micro font-medium text-ink-muted border border-line bg-surface hover:bg-surface-app px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              <ArchiveRestore size={11} /> Desarchivar
            </button>
          ) : s.estado !== "ACTIVO" ? (
            <button
              onClick={() => accion("archivar")}
              disabled={cambiando}
              className="flex items-center gap-1.5 text-micro font-medium text-ink-muted border border-line bg-surface hover:bg-surface-app px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
              title="Lo saca de la lista sin perder su historial"
            >
              <Archive size={11} /> Archivar
            </button>
          ) : null}

          <button
            onClick={() => setConfirmandoBorrado(true)}
            disabled={cambiando}
            className="flex items-center gap-1.5 text-micro font-medium text-bloqueo-ink border border-bloqueo-line bg-bloqueo-soft hover:bg-bloqueo-soft px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
            title="Solo se puede si el servicio no tiene trabajadores ni documentos"
          >
            <Trash2 size={11} /> Eliminar
          </button>
        </div>

        {s.estado !== "TERMINADO" && (
          <div className="flex gap-2 mt-2">
            {s.estado === "ACTIVO" ? (
              <button
                onClick={() => cambiarEstado("SUSPENDIDO")}
                disabled={cambiando}
                className="flex items-center gap-1.5 text-micro font-medium text-accion-ink border border-accion-line bg-accion-soft hover:bg-accion-soft px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
              >
                <Pause size={11} /> Suspender
              </button>
            ) : (
              <button
                onClick={() => cambiarEstado("ACTIVO")}
                disabled={cambiando}
                className="flex items-center gap-1.5 text-micro font-medium text-ok-ink border border-ok-line bg-ok-soft hover:bg-ok-soft px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
              >
                <Play size={11} /> Reactivar
              </button>
            )}
            <button
              onClick={() => cambiarEstado("TERMINADO")}
              disabled={cambiando}
              className="flex items-center gap-1.5 text-micro font-medium text-ink-muted border border-line bg-surface hover:bg-surface-app px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              <Square size={10} /> Terminar
            </button>
          </div>
        )}
        {error && <p className="text-meta text-bloqueo-ink mt-2">{error}</p>}
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

      {editando && (
        <EditarServicioDialog
          servicioId={s.id}
          onClose={() => setEditando(false)}
          onGuardado={() => { setEditando(false); onEstadoCambiado() }}
        />
      )}

      {/* Confirmación explícita: eliminar es lo único irreversible de esta
          pantalla. El texto dice qué se puede perder y cuál es la alternativa,
          en vez de un "¿estás seguro?" que no informa nada. */}
      {confirmandoBorrado && (
        <div
          className="fixed inset-0 bg-surface-inverse/40 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmandoBorrado(false)}
        >
          <div className="bg-surface rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-line-subtle">
              <p className="text-strong font-semibold text-ink">Eliminar servicio</p>
              <p className="text-meta text-ink-subtle mt-0.5 truncate">{s.nombre}</p>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-body text-ink-secondary">
                Solo se puede eliminar un servicio que no dejó rastro: sin trabajadores
                que hayan estado asignados y sin documentos.
              </p>
              <p className="text-body text-ink-secondary">
                Si tiene historial, la aplicación no lo va a borrar y te va a decir qué lo
                retiene. En ese caso, <span className="font-medium text-ink">archívalo</span>:
                sale de la lista y conserva todo.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-line-subtle flex gap-2">
              <button
                onClick={() => setConfirmandoBorrado(false)}
                className="flex-1 py-2.5 rounded-lg text-strong font-medium border border-line text-ink-muted hover:bg-surface-app transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={eliminar}
                disabled={cambiando}
                className="flex-1 py-2.5 rounded-lg text-strong font-medium bg-bloqueo-soft text-bloqueo-ink border border-bloqueo-line hover:bg-bloqueo-soft transition-colors disabled:opacity-50"
              >
                {cambiando ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<EstadoServicio | "TODOS">("TODOS")
  const [centroFiltro, setCentroFiltro] = useState("TODOS")
  // Archivar es "sácamelo de la lista", así que por defecto no se ven. El
  // switch existe para poder desarchivar algo que se escondió por error: sin
  // él, archivar sería un borrado irreversible con otro nombre.
  const [verArchivados, setVerArchivados] = useState(false)
  const [seleccionado, setSeleccionado] = useState<Servicio | null>(null)
  const [dialogAbierto, setDialogAbierto] = useState(false)

  // El filtro se lee de la URL para que la tarjeta de Centros pueda enlazar acá
  // ("ver los 3 servicios de Chuquicamata") y el enlace sea compartible.
  //
  // Se usa window.location y no useSearchParams a propósito: ese hook obliga a
  // envolver la página en <Suspense> y ya rompió el prerender antes. Acá el
  // efecto corre solo en el cliente, que es donde vive todo lo demás.
  useEffect(() => {
    const centro = new URLSearchParams(window.location.search).get("centro")
    if (centro) setCentroFiltro(centro)
  }, [])

  function cambiarCentro(id: string) {
    setCentroFiltro(id)
    const url = new URL(window.location.href)
    if (id === "TODOS") url.searchParams.delete("centro")
    else url.searchParams.set("centro", id)
    window.history.replaceState(null, "", url)
  }

  const cargar = useCallback(() => {
    api.get<Servicio[]>(`/api/v1/servicios/${verArchivados ? "?incluir_archivados=true" : ""}`)
      .then((data) => {
        setServicios(data)
        // Mantener el panel sincronizado tras un cambio de estado
        setSeleccionado((sel) => (sel ? data.find((s) => s.id === sel.id) ?? null : null))
      })
      .catch(() => setServicios([]))
  }, [verArchivados])

  useEffect(() => { cargar() }, [cargar])

  // Los centros salen de los propios servicios y no de /centros-trabajo: acá
  // solo sirven para filtrar lo que ya está en pantalla, y uno sin servicios
  // dejaría la tabla vacía sin explicar por qué.
  const centros = [...new Map(
    servicios
      .filter((s) => s.centro_trabajo_id)
      .map((s) => [s.centro_trabajo_id!, s.centro_trabajo_nombre ?? ""] as const),
  )].sort((a, b) => a[1].localeCompare(b[1]))
  const haySinCentro = servicios.some((s) => !s.centro_trabajo_id)

  const filtrados = servicios.filter((s) => {
    const q = busqueda.toLowerCase()
    const matchQ =
      s.nombre.toLowerCase().includes(q) ||
      s.contratista_razon_social.toLowerCase().includes(q) ||
      (s.codigo_referencia ?? "").toLowerCase().includes(q) ||
      (s.centro_trabajo_nombre ?? "").toLowerCase().includes(q)
    const matchE = filtro === "TODOS" || s.estado === filtro
    const matchC =
      centroFiltro === "TODOS" ||
      (centroFiltro === "SIN_CENTRO" ? !s.centro_trabajo_id : s.centro_trabajo_id === centroFiltro)
    return matchQ && matchE && matchC
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
              <h1 className="text-title font-semibold text-ink">Servicios</h1>
              <p className="text-body text-ink-muted mt-0.5">Contratos y faenas con sus exigencias documentales</p>
            </div>
            <button
              onClick={() => setDialogAbierto(true)}
              className="flex items-center gap-2 bg-surface-inverse text-white text-strong font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
            >
              <Plus size={15} />
              Nuevo servicio
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 sm:px-8 py-6 space-y-5">

          {/* Mismo criterio que en Contratistas: cuatro ceros no informan nada y
              ocupan la franja más visible de la pantalla. */}
          {servicios.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total", value: servicios.length, color: "text-ink" },
              { label: "Activos", value: kpi.activos, color: "text-ok-ink" },
              { label: "Suspendidos", value: kpi.suspendidos, color: "text-accion-ink" },
              { label: "Terminados", value: kpi.terminados, color: "text-ink-muted" },
            ].map((k) => (
              <div key={k.label} className="bg-surface rounded-xl border border-line px-5 py-4">
                <p className="text-micro font-medium text-ink-muted uppercase tracking-wider">{k.label}</p>
                <p className={cn("text-metric font-semibold mt-1 tabular", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>
          )}

          {/* Filtros */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                placeholder="Buscar servicio, empresa o N° contrato..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-body border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"
              />
            </div>
            {(centros.length > 0 || haySinCentro) && (
              <select
                value={centroFiltro}
                onChange={(e) => cambiarCentro(e.target.value)}
                className="px-3 py-2 text-body border border-line rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <option value="TODOS">Todos los centros</option>
                {centros.map(([id, nombre]) => (
                  <option key={id} value={id}>{nombre}</option>
                ))}
                {haySinCentro && <option value="SIN_CENTRO">Sin centro asignado</option>}
              </select>
            )}
            <div className="flex items-center gap-1 bg-surface border border-line rounded-lg p-1">
              {(["TODOS", "ACTIVO", "SUSPENDIDO", "TERMINADO"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setFiltro(e)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-micro font-medium transition-colors",
                    filtro === e ? "bg-surface-inverse text-white" : "text-ink-muted hover:text-ink"
                  )}
                >
                  {e === "TODOS" ? "Todos" : LABEL_SERVICIO[e] + "s"}
                </button>
              ))}
            </div>

            {/* Sin esto, archivar sería un borrado irreversible con otro
                nombre: no habría forma de llegar a lo archivado para
                desarchivarlo. */}
            <button
              onClick={() => setVerArchivados((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-micro font-medium transition-colors border",
                verArchivados
                  ? "bg-surface-inverse text-white border-line"
                  : "text-ink-muted hover:text-ink border-line bg-surface",
              )}
            >
              <Archive size={11} />
              {verArchivados ? "Ocultar archivados" : "Ver archivados"}
            </button>

            <p className="text-meta text-ink-subtle ml-auto">{filtrados.length} de {servicios.length}</p>
          </div>

          {/* Tabla */}
          <div className="bg-surface border border-line rounded-xl overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-line-subtle bg-surface-app/60">
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Servicio</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Contratista</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Centro</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider hidden lg:table-cell">Perfil</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Dotación</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Inicio</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Estado</th>
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
                      <td className="px-4 py-3.5">
                        {s.centro_trabajo_nombre ? (
                          <p className="text-meta text-ink-secondary flex items-center gap-1.5">
                            <MapPin size={11} className="text-ink-subtle shrink-0" />
                            <span className="truncate max-w-[140px]">{s.centro_trabajo_nombre}</span>
                          </p>
                        ) : (
                          <span className="text-meta text-accion-ink">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-meta text-ink-muted hidden lg:table-cell">{s.perfil_nombre}</td>
                      <td className="px-4 py-3.5 text-meta text-ink-muted">{s.trabajadores_asignados}</td>
                      <td className="px-4 py-3.5 text-meta text-ink-subtle">{s.fecha_inicio}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <EstadoServicioBadge estado={s.estado} />
                          {/* El archivado conserva su estado real —SUSPENDIDO o
                              TERMINADO—, así que la marca va AL LADO del badge y
                              no en su lugar: son dos hechos distintos. */}
                          {s.archivado_en && (
                            <span
                              title="Archivado: fuera de la lista, con su historial intacto"
                              className="inline-flex items-center gap-1 text-[10px] text-ink-subtle border border-line rounded px-1.5 py-0.5"
                            >
                              <Archive size={9} /> Archivado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <ChevronRight size={14} className={cn("text-ink-subtle transition-transform", selected && "rotate-90 text-ink-muted")} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Mismo criterio que en Contratistas: no es lo mismo "todavía no hay
                ninguna" que "tu filtro no encontró nada". */}
            {filtrados.length === 0 && (
              <div className="py-14 px-6 text-center">
                {servicios.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-strong font-medium text-ink">Todavía no hay ninguna faena</p>
                    <p className="text-meta text-ink-subtle max-w-md mx-auto leading-relaxed">
                      Una faena une a una empresa contratista con un lugar de trabajo y un perfil
                      de exigencias. Recién ahí empiezan a correr los documentos que le pides.
                      Necesitas al menos un perfil, un centro y una empresa invitada.
                    </p>
                  </div>
                ) : (
                  <p className="text-body text-ink-subtle">
                    Ninguna faena coincide con lo que buscas.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel lateral */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Panel de detalle"
 className={cn(
        "fixed right-0 top-0 h-full w-full sm:w-96 bg-surface border-l border-line shadow-xl z-20 transition-transform duration-300",
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
