"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle, ArrowRight, Building2, CalendarClock, CheckCircle2, Clock, ShieldQuestion,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import {
  ESTADO_GLOBAL_CFG, vigenciaMasProxima,
  type DocumentoContratista, type ResumenMandante,
} from "@/entities/contratista/resumen"
import { diasParaVencer, formatFecha } from "@/entities/documento/exigencia"

// ── Piezas ───────────────────────────────────────────────────────────────────

function MandanteCard({ r }: { r: ResumenMandante }) {
  const c = ESTADO_GLOBAL_CFG[r.estado_global] ?? ESTADO_GLOBAL_CFG.PENDIENTE
  const Icono = r.estado_global === "ACREDITADA" ? CheckCircle2 : Clock

  return (
    <div className={cn(
      "rounded-xl border bg-white p-4",
      r.estado_global === "BLOQUEADA" ? "border-red-200" : "border-slate-200"
    )}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-slate-900 leading-tight">{r.mandante_razon_social}</p>
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0",
          c.bg, c.border, c.text
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
          {c.label}
        </span>
      </div>

      <p className="text-xs text-slate-500">
        {r.servicios_activos === 0
          ? "Sin servicios activos"
          : `${r.servicios_activos} servicio${r.servicios_activos === 1 ? "" : "s"}`}
        {r.trabajadores_total > 0 && ` · ${r.trabajadores_ok}/${r.trabajadores_total} trabajadores`}
      </p>

      <div className="mt-3 pt-3 border-t border-slate-100">
        {r.brechas.length === 0 ? (
          <p className="text-xs text-emerald-700 flex items-center gap-1.5">
            <Icono size={13} /> Sin brechas
          </p>
        ) : (
          <>
            <p className="text-xs text-red-700 flex items-center gap-1.5 font-medium">
              <AlertCircle size={13} />
              {r.brechas.length} brecha{r.brechas.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {r.brechas.slice(0, 2).map((b, i) => (
                <li key={i} className="text-[11px] text-slate-500 truncate">{b}</li>
              ))}
              {r.brechas.length > 2 && (
                <li className="text-[10px] text-slate-400">y {r.brechas.length - 2} más</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

/** Documentos aprobados que caducan pronto. */
function AvisoPorVencer({ docs }: { docs: DocumentoContratista[] }) {
  const items = docs
    .map(d => {
      const vence = vigenciaMasProxima(d)
      return { doc: d, vence, dias: diasParaVencer(vence) }
    })
    .filter(x => x.dias !== null && x.dias >= 0 && x.dias <= 30)
    .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0))

  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <CalendarClock size={18} className="text-orange-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {items.length === 1 ? "1 documento por vencer" : `${items.length} documentos por vencer`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Renuévalos antes de que caduquen para no perder la acreditación.
          </p>
          <ul className="mt-3 space-y-1.5">
            {items.slice(0, 4).map(({ doc, vence, dias }) => (
              <li key={doc.clave} className="flex items-baseline gap-2 text-xs">
                <span className={cn(
                  "font-medium tabular-nums shrink-0",
                  (dias ?? 0) <= 7 ? "text-red-600" : "text-orange-700"
                )}>
                  {dias === 0 ? "hoy" : dias === 1 ? "1 día" : `${dias} días`}
                </span>
                <span className="text-slate-600 truncate">
                  {doc.requisito_nombre}
                  {doc.trabajador_nombre && <span className="text-slate-400"> · {doc.trabajador_nombre}</span>}
                </span>
                <span className="text-slate-400 shrink-0 ml-auto">{formatFecha(vence)}</span>
              </li>
            ))}
          </ul>
          {items.length > 4 && (
            <p className="text-[10px] text-slate-400 mt-2">y {items.length - 4} más</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-slate-200 rounded-lg", className)} />
}

// ── Página ───────────────────────────────────────────────────────────────────

/**
 * Dashboard del contratista: un RESUMEN, no un inventario.
 *
 * Responde tres preguntas: con qué cliente estoy mal, qué vence pronto y qué
 * espera una acción mía. El inventario vive en /contratista/documentos.
 *
 * Antes listaba todos los documentos de un único mandante —elegido al azar en
 * el token— sin decir cuál era, así que duplicaba /documentos con menos
 * capacidades y ocultaba que el contratista tiene varios clientes.
 */
export default function DashboardContratistaPage() {
  const [resumen, setResumen] = useState<ResumenMandante[] | null>(null)
  const [docs, setDocs] = useState<DocumentoContratista[]>([])
  const [solicitudes, setSolicitudes] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    Promise.all([
      api.get<ResumenMandante[]>("/api/v1/acreditacion/mi-resumen"),
      api.get<DocumentoContratista[]>("/api/v1/documentos/mis-documentos"),
      api.get<unknown[]>("/api/v1/reutilizacion/solicitudes").catch(() => []),
    ])
      .then(([r, d, s]) => { setResumen(r); setDocs(d); setSolicitudes(s.length) })
      .catch(e => { setResumen([]); setError(e instanceof Error ? e.message : "Error al cargar") })
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (resumen === null) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
        </div>
        <Skeleton className="h-24 rounded-xl" />
      </div>
    )
  }

  const bloqueadas = resumen.filter(r => r.estado_global === "BLOQUEADA").length
  const acreditadas = resumen.filter(r => r.estado_global === "ACREDITADA").length

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <h1 className="text-xl font-semibold text-slate-900">Mi acreditación</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {resumen.length === 0
            ? "Aún no tienes clientes vinculados"
            : bloqueadas > 0
              ? `${bloqueadas} de tus ${resumen.length} clientes tiene brechas que te bloquean`
              : `Estás acreditado con ${acreditadas} de ${resumen.length} clientes`}
        </p>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
        )}

        {solicitudes > 0 && (
          <button
            onClick={() => window.location.href = "/contratista/solicitudes"}
            className="w-full rounded-xl border border-violet-200 bg-violet-50 px-5 py-4 flex items-center gap-3 text-left hover:bg-violet-100/70 transition-colors"
          >
            <ShieldQuestion size={18} className="text-violet-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {solicitudes === 1
                  ? "1 solicitud de acceso espera tu autorización"
                  : `${solicitudes} solicitudes de acceso esperan tu autorización`}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Un cliente quiere revisar documentos que marcaste como sensibles.
              </p>
            </div>
            <ArrowRight size={15} className="text-slate-400 shrink-0" />
          </button>
        )}

        <AvisoPorVencer docs={docs} />

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Mis clientes ({resumen.length})
              </h2>
            </div>
            <button
              onClick={() => window.location.href = "/contratista/documentos"}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              Ver mis documentos <ArrowRight size={12} />
            </button>
          </div>

          {resumen.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
              <Building2 size={26} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Todavía ningún mandante te ha vinculado</p>
              <p className="text-xs text-slate-400 mt-1">
                Cuando te inviten y creen un servicio, verás aquí tu estado con cada uno.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {resumen.map(r => <MandanteCard key={r.mandante_id} r={r} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
