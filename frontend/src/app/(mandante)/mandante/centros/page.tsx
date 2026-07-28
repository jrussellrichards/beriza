"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, MapPin, Plus, UserCircle2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { getSession } from "@/shared/lib/auth"
import { CentroTrabajoDialog, type CentroTrabajo } from "@/features/mandante/centro-trabajo-dialog"

/**
 * Centros de trabajo: los lugares físicos donde se ejecutan los servicios.
 *
 * Antes no existían como entidad. "Faena" era una etiqueta sobre el contrato de
 * UN contratista, así que con cinco contratistas en Chuquicamata había cinco
 * contratos sueltos y ninguna forma de preguntar por Chuquicamata.
 *
 * El centro cuelga del mandante y los contratistas se relacionan con él a través
 * de sus servicios — no al revés. Por eso un mismo transportista puede aparecer
 * en dos centros a la vez, que es el caso normal.
 */
export default function CentrosPage() {
  const [centros, setCentros] = useState<CentroTrabajo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogo, setDialogo] = useState<{ centro: CentroTrabajo | null } | null>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    api.get<CentroTrabajo[]>("/api/v1/centros-trabajo/?incluir_inactivos=true")
      .then(setCentros)
      .catch(e => setError(e instanceof Error ? e.message : "No se pudieron cargar los centros"))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const [esAdmin, setEsAdmin] = useState(false)
  useEffect(() => { setEsAdmin(getSession()?.rol === "mandante_admin") }, [])

  const activos = centros.filter(c => c.activo)
  const cerrados = centros.filter(c => !c.activo)
  const sinEncargado = activos.filter(c => !c.encargado_id).length

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-semibold text-ink">Centros de trabajo</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            {activos.length === 0
              ? "Registra las faenas, obras y plantas donde trabajan tus contratistas"
              : sinEncargado > 0
                ? `${activos.length} en operación · ${sinEncargado} sin encargado asignado`
                : `${activos.length} en operación`}
          </p>
        </div>
        {esAdmin && (
          <button
            onClick={() => setDialogo({ centro: null })}
            className="inline-flex items-center justify-center gap-2 bg-surface-inverse text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
          >
            <Plus size={14} /> Nuevo centro
          </button>
        )}
      </div>

      <div className="flex-1 px-6 sm:px-8 py-6 space-y-6">
        {error && (
          <p className="text-sm text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line px-3 py-2 rounded-lg">{error}</p>
        )}

        {cargando ? (
          <p className="text-sm text-ink-subtle py-14 text-center">Cargando centros...</p>
        ) : centros.length === 0 ? (
          <div className="py-14 text-center bg-surface rounded-xl border border-dashed border-line">
            <MapPin size={26} className="text-ink-subtle mx-auto mb-3" />
            <p className="text-sm text-ink-muted">Todavía no hay centros de trabajo</p>
            <p className="text-xs text-ink-subtle mt-1 max-w-md mx-auto">
              Un centro es el lugar donde se ejecuta el trabajo: Chuquicamata, una obra,
              una planta. Al crear un servicio se indica en cuál se ejecuta.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activos.map(c => (
                <Tarjeta key={c.id} c={c} onEditar={() => setDialogo({ centro: c })} esAdmin={esAdmin} />
              ))}
            </div>

            {cerrados.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-ink-subtle uppercase tracking-wider">
                  Cerrados
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cerrados.map(c => (
                    <Tarjeta key={c.id} c={c} onEditar={() => setDialogo({ centro: c })} esAdmin={esAdmin} />
                  ))}
                </div>
                <p className="text-[10px] text-ink-subtle">
                  Un centro cerrado no admite servicios nuevos, pero conserva su historial:
                  la bitácora necesita saber dónde ocurrieron las cosas.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {dialogo && (
        <CentroTrabajoDialog
          centro={dialogo.centro}
          onClose={() => setDialogo(null)}
          onGuardado={() => { setDialogo(null); cargar() }}
        />
      )}
    </div>
  )
}

function Tarjeta({ c, onEditar, esAdmin }: {
  c: CentroTrabajo
  onEditar: () => void
  esAdmin: boolean
}) {
  return (
    <div className={cn(
      "bg-surface border rounded-xl px-4 py-3.5 flex flex-col gap-2",
      c.activo ? "border-line" : "border-line opacity-60",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink truncate">{c.nombre}</p>
          {c.direccion && (
            <p className="text-xs text-ink-subtle mt-0.5 flex items-start gap-1">
              <MapPin size={11} className="mt-0.5 shrink-0" />
              <span className="min-w-0">{c.direccion}</span>
            </p>
          )}
        </div>
        {esAdmin && (
          <button
            onClick={onEditar}
            className="text-xs text-ink-muted hover:text-ink border border-line px-2 py-1 rounded-lg hover:bg-surface-app transition-colors shrink-0"
          >
            Editar
          </button>
        )}
      </div>

      <p className="text-xs flex items-center gap-1.5">
        <UserCircle2 size={12} className="text-ink-subtle shrink-0" />
        {c.encargado_nombre
          ? <span className="text-ink-secondary">{c.encargado_nombre}</span>
          // Vacante no es un error, es un estado real: la persona renunció y
          // todavía no se designa reemplazo.
          : <span className="text-accion-ink">Sin encargado asignado</span>}
      </p>

      {/* Saber que hay 3 servicios sirve poco si no se puede ver cuáles: la
          razón de que el centro exista es poder preguntar por el lugar. */}
      {c.servicios_activos === 0 ? (
        <p className="text-[11px] text-ink-muted">Sin servicios activos</p>
      ) : (
        <Link
          href={`/mandante/servicios?centro=${c.id}`}
          className="text-[11px] text-ink-muted hover:text-ink inline-flex items-center gap-1 w-fit transition-colors"
        >
          {c.servicios_activos} servicio{c.servicios_activos === 1 ? "" : "s"} en curso
          <ChevronRight size={11} />
        </Link>
      )}
    </div>
  )
}
