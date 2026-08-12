"use client"

import { useCallback, useEffect, useState } from "react"
import { Briefcase, ChevronRight, MapPin, Plus, UserMinus, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { EstadoServicioBadge, LABEL_SERVICIO } from "@/shared/ui/estado-badge"
import { api } from "@/shared/lib/api"
import { getSession } from "@/shared/lib/auth"
import { AvancePanel } from "@/entities/servicio/avance-panel"
import type { EstadoServicio, Servicio } from "@/entities/servicio/types"

interface TrabajadorItem {
  id: string
  rut: string
  nombre_completo: string
  // Texto libre de la nomina. Es una etiqueta y no decide nada.
  cargo: string | null
  activo: boolean
  // Cargo del CATALOGO del mandante, el que decide que documentos se le exigen
  // en esta faena. Solo viene en el listado de dotacion de un servicio.
  cargo_id?: string | null
  cargo_nombre?: string | null
}

interface CargoOpcion {
  id: string
  codigo: string
  nombre: string
  area: string | null
}

// ── Gestión de dotación ───────────────────────────────────────────────────────

function DotacionTab({ servicio, onCambio }: { servicio: Servicio; onCambio: () => void }) {
  const [asignados, setAsignados] = useState<TrabajadorItem[]>([])
  const [disponibles, setDisponibles] = useState<TrabajadorItem[]>([])
  const [seleccion, setSeleccion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  // Cargos que aplican EN ESTA faena: los globales mas los del mandante de este
  // servicio. No se usa /cargos/ porque ese filtra por usuario.mandante_id, que
  // en un contratista es NULL —trabaja para varios— y devolveria vacio.
  const [cargos, setCargos] = useState<CargoOpcion[]>([])
  const [guardandoCargo, setGuardandoCargo] = useState<string | null>(null)

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

  useEffect(() => {
    api.get<CargoOpcion[]>(`/api/v1/servicios/${servicio.id}/cargos-disponibles`)
      .then(setCargos)
      .catch(() => setCargos([]))
  }, [servicio.id])

  async function definirCargo(trabajadorId: string, cargoId: string) {
    setGuardandoCargo(trabajadorId)
    setError(null)
    try {
      await api.patch(`/api/v1/servicios/${servicio.id}/trabajadores/${trabajadorId}/cargo`,
                      { cargo_id: cargoId || null })
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo asignar el cargo")
    } finally {
      setGuardandoCargo(null)
    }
  }

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
            // min-w-0: un item flex no baja de su contenido por defecto (min-width:auto),
            // asi que los nombres largos empujaban el boton "Asignar" fuera del panel.
            className="flex-1 min-w-0 px-3 py-2 text-body border border-line rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="" disabled>Agregar trabajador a la faena...</option>
            {disponibles.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre_completo} — {t.rut}</option>
            ))}
          </select>
          <button
            onClick={asignar}
            disabled={!seleccion || cargando}
            className="shrink-0 flex items-center gap-1.5 bg-surface-inverse text-white text-micro font-medium px-3 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors disabled:opacity-40"
          >
            <Plus size={13} /> Asignar
          </button>
        </div>
      ) : (
        <p className="text-meta text-ink-subtle bg-surface-app border border-line-subtle rounded-md px-3 py-2">
          Solo se puede modificar la dotación de servicios activos.
        </p>
      )}

      {error && <p className="text-meta text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}

      <div className="space-y-1.5">
        {asignados.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-surface-app border border-line-subtle">
            <div className="min-w-0">
              <p className="text-strong font-medium text-ink truncate">{t.nombre_completo}</p>
              <p className="text-meta text-ink-subtle font-mono">{t.rut}{t.cargo ? ` · ${t.cargo}` : ""}</p>
            </div>

            {/* Cargo con el que participa en ESTA faena. Decide que documentos se
                le exigen. Sin cargo NO queda exento: se le exige todo. */}
            {cargos.length > 0 && puedeEditar && (
              <div className="shrink-0 flex items-center gap-1.5">
                <select
                  value={t.cargo_id ?? ""}
                  disabled={guardandoCargo === t.id}
                  onChange={(e) => definirCargo(t.id, e.target.value)}
                  className={cn(
                    "text-meta rounded-md border px-2 py-1 bg-surface transition-colors",
                    t.cargo_id ? "border-line text-ink" : "border-accion-line text-accion-ink bg-accion-soft",
                  )}
                  title={t.cargo_id
                    ? "Cargo con el que participa en esta faena"
                    : "Sin cargo: se le exige todo el set de documentos"}
                >
                  <option value="">Sin cargo</option>
                  {cargos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            {puedeEditar && (
              <button
                onClick={() => desasignar(t.id)}
                disabled={cargando}
                title="Desasignar de la faena"
                className="text-ink-subtle hover:text-bloqueo-ink transition-colors disabled:opacity-40"
              >
                <UserMinus size={14} />
              </button>
            )}
          </div>
        ))}
        {asignados.length === 0 && (
          <p className="text-meta text-ink-subtle italic px-1">Sin trabajadores asignados a esta faena</p>
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
      <div className="px-5 pt-5 pb-0 border-b border-line-subtle">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-strong font-semibold text-ink leading-tight">{s.nombre}</p>
            <p className="text-meta text-ink-subtle">
              {s.codigo_referencia ? `${s.codigo_referencia} · ` : ""}Perfil: {s.perfil_nombre}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted shrink-0">
            <X size={16} />
          </button>
        </div>
        <EstadoServicioBadge estado={s.estado} />

        {/* Dónde hay que presentarse y a quién avisar. Hasta ahora el sistema
            tenía el dato y el contratista igual lo pedía por WhatsApp. */}
        {s.centro_trabajo_nombre && (
          <div className="mt-3 bg-surface-app border border-line-subtle rounded-lg px-3 py-2.5 space-y-1.5">
            <p className="text-micro font-medium text-ink flex items-center gap-1.5">
              <MapPin size={12} className="text-ink-subtle shrink-0" />
              {s.centro_trabajo_nombre}
            </p>
            {s.centro_trabajo_direccion && (
              <p className="text-[11px] text-ink-muted pl-[18px]">{s.centro_trabajo_direccion}</p>
            )}
            {s.centro_trabajo_encargado && (
              <p className="text-[11px] text-ink-muted pl-[18px]">
                Encargado: <span className="text-ink-secondary">{s.centro_trabajo_encargado}</span>
                {s.centro_trabajo_encargado_email && (
                  <>
                    {" · "}
                    <a
                      href={`mailto:${s.centro_trabajo_encargado_email}`}
                      className="text-brand hover:underline"
                    >
                      {s.centro_trabajo_encargado_email}
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-0 mt-4 -mb-px">
          {([["avance", "Avance"], ["dotacion", "Dotación"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "px-3 py-2 text-micro font-medium border-b-2 transition-colors",
                tab === id ? "border-ink text-ink" : "border-transparent text-ink-subtle hover:text-ink-muted"
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
    <div className="flex min-h-screen">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", seleccionado ? "lg:mr-96" : "")}>

        <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface">
          <h1 className="text-title sm:text-title font-semibold text-ink">Mis servicios</h1>
          <p className="text-body text-ink-muted mt-0.5">
            Lo que cada cliente te contrató, su avance y la dotación asignada
          </p>
        </div>

        <div className="flex-1 px-6 sm:px-8 py-6 overflow-x-auto">
          <div className="bg-surface border border-line rounded-xl overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-line-subtle bg-surface-app/60">
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Servicio</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Dónde</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider hidden lg:table-cell">Perfil</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Dotación</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Inicio</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {servicios.map((s) => {
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
                            <p className="font-medium text-ink truncate max-w-[240px]">{s.nombre}</p>
                            <p className="text-[10px] text-ink-muted">{s.mandante_razon_social}</p>
                            {s.codigo_referencia && (
                              <p className="text-[10px] text-ink-subtle font-mono">{s.codigo_referencia}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {s.centro_trabajo_nombre ? (
                          <>
                            <p className="text-meta text-ink-secondary flex items-center gap-1.5">
                              <MapPin size={11} className="text-ink-subtle shrink-0" />
                              <span className="truncate max-w-[140px]">{s.centro_trabajo_nombre}</span>
                            </p>
                            {s.centro_trabajo_direccion && (
                              <p className="text-[10px] text-ink-subtle truncate max-w-[160px] pl-[18px]">
                                {s.centro_trabajo_direccion}
                              </p>
                            )}
                          </>
                        ) : (
                          // El contratista no puede arreglarlo: lo asigna el
                          // mandante. Se dice en gris, no en ámbar de acción.
                          <span className="text-meta text-ink-subtle">Por confirmar</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-meta text-ink-muted hidden lg:table-cell">{s.perfil_nombre}</td>
                      <td className="px-4 py-3.5 text-meta text-ink-muted">{s.trabajadores_asignados}</td>
                      <td className="px-4 py-3.5 text-meta text-ink-subtle">{s.fecha_inicio}</td>
                      <td className="px-4 py-3.5"><EstadoServicioBadge estado={s.estado} /></td>
                      <td className="px-4 py-3.5">
                        <ChevronRight size={14} className={cn("text-ink-subtle transition-transform", selected && "rotate-90 text-ink-muted")} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {servicios.length === 0 && (
              <div className="py-14 text-center">
                <p className="text-body text-ink-subtle">Aún no tienes servicios contratados</p>
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
          <DetailPanel s={seleccionado} onClose={() => setSeleccionado(null)} onCambio={cargar} />
        )}
      </div>
    </div>
  )
}
