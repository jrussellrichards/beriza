"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { PendienteRow } from "@/entities/contratista/pendiente-row"
import { type Pendiente, type ServicioContratista } from "@/entities/contratista/resumen"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-line rounded-lg", className)} />
}

/** Un servicio con su estado derivado de los pendientes que lo afectan. */
function ServicioRow({ s, motivo }: { s: ServicioContratista; motivo: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-surface-app rounded-lg px-4 py-2.5">
      <span className={cn(
        "w-1.5 h-1.5 rounded-full shrink-0 hidden sm:block",
        motivo ? "bg-bloqueo-ink" : "bg-ok-ink"
      )} />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-ink">{s.nombre}</span>
      </div>
      <span className={cn("text-xs shrink-0", motivo ? "text-bloqueo-ink" : "text-ok-ink")}>
        {motivo ?? "Lista para empezar"}
      </span>
    </div>
  )
}

/**
 * Inicio del contratista: ¿puedo trabajar y qué hago ahora?
 *
 * Dos bloques y nada más: los pendientes —todo lo que requiere una acción suya,
 * de cualquier tipo, en una sola lista por urgencia— y sus servicios agrupados
 * por cliente. El inventario de documentos vive en su propia pantalla.
 *
 * El estado se muestra POR SERVICIO y no por cliente: dos servicios del mismo
 * mandante pueden exigir cosas distintas, así que un rollup por cliente diría
 * "bloqueada" sin decir dónde.
 */
export default function InicioContratistaPage() {
  const [pendientes, setPendientes] = useState<Pendiente[] | null>(null)
  const [servicios, setServicios] = useState<ServicioContratista[]>([])
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    Promise.all([
      api.get<Pendiente[]>("/api/v1/acreditacion/mis-pendientes"),
      api.get<ServicioContratista[]>("/api/v1/servicios/"),
    ])
      .then(([p, s]) => { setPendientes(p); setServicios(s.filter(x => x.estado === "ACTIVO")) })
      .catch(e => { setPendientes([]); setServicios([]); setError(e instanceof Error ? e.message : "No se pudo cargar tu estado") })
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (pendientes === null) {
    return (
      <div className="p-6 sm:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  // El motivo de bloqueo de cada servicio sale de sus propios pendientes.
  const motivoPorServicio = new Map<string, string>()
  pendientes.forEach(p => {
    if (p.servicio_id && !motivoPorServicio.has(p.servicio_id)) {
      motivoPorServicio.set(p.servicio_id, p.titulo)
    }
  })

  const listos = servicios.filter(s => !motivoPorServicio.has(s.id)).length
  const porCliente = new Map<string, ServicioContratista[]>()
  servicios.forEach(s => {
    if (!porCliente.has(s.mandante_razon_social)) porCliente.set(s.mandante_razon_social, [])
    porCliente.get(s.mandante_razon_social)!.push(s)
  })

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface">
        <h1 className="text-lg sm:text-xl font-semibold text-ink">Mi acreditación</h1>
        <p className="text-sm text-ink-muted mt-0.5">
          {error
            ? "No pudimos cargar tu estado"
            : servicios.length === 0
            ? "Aún no tienes servicios activos"
            : listos === servicios.length
              ? `Puedes trabajar en tus ${servicios.length} servicios`
              : `Puedes trabajar en ${listos} de tus ${servicios.length} servicios`}
        </p>
      </div>

      <div className="flex-1 px-6 sm:px-8 py-6 space-y-6">
        {error && (
          <p className="text-sm text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line px-3 py-2 rounded-lg">{error}</p>
        )}

        <section>
          <p className="text-xs text-ink-muted mb-2">
            Pendientes{pendientes.length > 0 && ` · ${pendientes.length}`}
          </p>
          {error ? (
            // Nunca decir "estás al día" si no pudimos leer los pendientes: sería
            // afirmar que no tiene nada que hacer cuando no lo sabemos.
            <div className="bg-surface border border-line rounded-xl px-5 py-6 flex items-center gap-3">
              <AlertTriangle size={20} className="text-accion-ink shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink">No pudimos revisar tus pendientes</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  Vuelve a cargar la página. Si sigue fallando, puede haber documentos esperando tu acción.
                </p>
              </div>
            </div>
          ) : pendientes.length === 0 ? (
            <div className="bg-surface border border-line rounded-xl px-5 py-6 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-ok-ink shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink">Estás al día</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  No hay nada esperando una acción tuya.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-xl overflow-hidden">
              {pendientes.map((p, i) => (
                <PendienteRow key={`${p.tipo}-${p.documento_id ?? p.trabajador_id ?? i}`} p={p} onResuelto={cargar} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-ink-muted">Mis servicios</p>
            <button
              onClick={() => window.location.href = "/contratista/servicios"}
              className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors"
            >
              Ver detalle <ArrowRight size={12} />
            </button>
          </div>

          {servicios.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-10 text-center">
              <p className="text-sm text-ink-muted">Todavía ningún cliente te ha contratado</p>
              <p className="text-xs text-ink-subtle mt-1">
                Cuando creen un servicio para tu empresa, aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...porCliente.entries()].map(([cliente, ss]) => (
                <div key={cliente}>
                  <p className="text-sm font-medium text-ink mb-1.5">{cliente}</p>
                  <div className="space-y-1.5">
                    {ss.map(s => (
                      <ServicioRow key={s.id} s={s} motivo={motivoPorServicio.get(s.id) ?? null} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
