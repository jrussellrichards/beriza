"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, UserX } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { PuestaEnMarcha } from "@/features/mandante/puesta-en-marcha"
import { type RiesgoMandante, type ServicioEnRiesgo } from "@/entities/contratista/resumen"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-line rounded-lg", className)} />
}

/** Una faena con su exposición. El rojo se reserva para gente que no puede entrar. */
function FaenaRow({ s }: { s: ServicioEnRiesgo }) {
  const enRiesgo = s.trabajadores_no_habilitados > 0 || s.brechas_empresa.length > 0

  return (
    <button
      onClick={() => window.location.href = "/mandante/servicios"}
      className={cn(
        "w-full text-left bg-surface border rounded-xl px-4 py-3.5 hover:bg-surface-app/70 transition-colors",
        s.trabajadores_no_habilitados > 0 ? "border-bloqueo-line" : "border-line"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-strong font-medium text-ink">{s.servicio_nombre}</span>
          </div>
          <p className="text-meta text-ink-muted mt-0.5">{s.contratista_razon_social}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0 text-meta">
          {s.trabajadores_no_habilitados > 0 && (
            <span className="inline-flex items-center gap-1.5 text-bloqueo-ink font-medium">
              <UserX size={12} />
              {s.trabajadores_no_habilitados} de {s.trabajadores_asignados} no puede{s.trabajadores_no_habilitados === 1 ? "" : "n"} ingresar
            </span>
          )}
          {s.documentos_pendientes > 0 && (
            <span className="text-accion-ink">{s.documentos_pendientes} por revisar</span>
          )}
          {!enRiesgo && (
            <span className="inline-flex items-center gap-1.5 text-ok-ink">
              <CheckCircle2 size={12} /> Todo en regla
            </span>
          )}
        </div>
      </div>

      {s.brechas_empresa.length > 0 && (
        <p className="text-[11px] text-ink-muted mt-2 pt-2 border-t border-line-subtle">
          Falta de la empresa: {s.brechas_empresa.slice(0, 3).join(", ")}
          {s.brechas_empresa.length > 3 && ` y ${s.brechas_empresa.length - 3} más`}
        </p>
      )}
    </button>
  )
}

/**
 * Inicio del mandante: ¿dónde estoy expuesto?
 *
 * Antes mostraba "total contratistas" y "acreditadas", que son datos de vanidad:
 * al mandante no le sirve saber que tiene 12 contratistas, le sirve saber en qué
 * faena hay alguien trabajando sin poder ingresar — que es de lo que responde
 * ante la Ley 20.123.
 *
 * La unidad es la FAENA y no el contratista: una empresa puede estar impecable
 * en una obra y tener gente sin habilitar en otra.
 */
export default function InicioMandantePage() {
  const [riesgo, setRiesgo] = useState<RiesgoMandante | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    api.get<RiesgoMandante>("/api/v1/acreditacion/mi-riesgo")
      .then(setRiesgo)
      .catch(e => setError(e instanceof Error ? e.message : "No se pudo cargar tu estado"))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (!riesgo && !error) {
    return (
      <div className="p-6 sm:p-8 space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (error || !riesgo) {
    return (
      <div className="p-6 sm:p-8">
        <div className="rounded-xl border border-accion-line bg-accion-soft px-5 py-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-accion-ink mt-0.5 shrink-0" />
          <div>
            <p className="text-strong font-medium text-ink">No pudimos revisar el estado de tus faenas</p>
            <p className="text-meta text-ink-muted mt-1">
              {error} — vuelve a cargar la página. Mientras no carguemos esto, puede haber
              personal trabajando sin cumplir.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const sinRiesgo = riesgo.servicios_en_riesgo === 0

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface">
        <h1 className="text-title sm:text-title font-semibold text-ink">Estado de mis faenas</h1>
        <p className="text-body text-ink-muted mt-0.5">
          {riesgo.total_servicios === 0
            ? "Aún no tienes servicios activos"
            : sinRiesgo
              ? `Tus ${riesgo.total_servicios} servicios activos están en regla`
              : `${riesgo.servicios_en_riesgo} de ${riesgo.total_servicios} servicios tienen incumplimientos`}
        </p>
      </div>

      <div className="flex-1 px-6 sm:px-8 py-6 space-y-6">
        {/* Va PRIMERO y desaparece sola al completarse: mientras falte un paso,
            es lo único que este usuario necesita ver. */}
        <PuestaEnMarcha tieneServicios={riesgo.total_servicios > 0} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={cn(
            "rounded-xl border p-4",
            riesgo.personas_no_habilitadas > 0 ? "border-bloqueo-line bg-bloqueo-soft" : "border-line bg-surface"
          )}>
            <p className="text-meta text-ink-muted">Personas sin poder ingresar</p>
            <p className={cn(
              "text-title font-semibold mt-1",
              riesgo.personas_no_habilitadas > 0 ? "text-bloqueo-ink" : "text-ink"
            )}>
              {riesgo.personas_no_habilitadas}
            </p>
            <p className="text-[11px] text-ink-muted mt-1">
              asignadas a una faena sin cumplir sus requisitos
            </p>
          </div>

          <button
            onClick={() => window.location.href = "/mandante/revision"}
            className="text-left rounded-xl border border-line bg-surface p-4 hover:bg-surface-app/70 transition-colors"
          >
            <p className="text-meta text-ink-muted">Esperando tu revisión</p>
            <p className="text-title font-semibold text-ink mt-1">{riesgo.documentos_por_revisar}</p>
            <p className="text-[11px] text-ink-muted mt-1 inline-flex items-center gap-1">
              Ir a Revisión <ArrowRight size={10} />
            </p>
          </button>

          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-meta text-ink-muted">Faenas en regla</p>
            <p className="text-title font-semibold text-ink mt-1">
              {riesgo.total_servicios - riesgo.servicios_en_riesgo}
              <span className="text-body text-ink-subtle font-normal">/{riesgo.total_servicios}</span>
            </p>
            <p className="text-[11px] text-ink-muted mt-1">sin incumplimientos abiertos</p>
          </div>
        </div>

        <section>
          <p className="text-meta text-ink-muted mb-2">Mis faenas · más expuestas primero</p>

          {riesgo.servicios.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-12 text-center">
              <ClipboardCheck size={24} className="text-ink-subtle mx-auto mb-3" />
              <p className="text-body text-ink-muted">No tienes servicios activos</p>
              <p className="text-meta text-ink-subtle mt-1">
                Cuando tengas una faena creada, acá vas a ver dónde hay gente sin
                poder ingresar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {riesgo.servicios.map(s => <FaenaRow key={s.servicio_id} s={s} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
