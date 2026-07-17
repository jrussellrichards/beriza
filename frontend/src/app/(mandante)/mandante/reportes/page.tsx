"use client"

import { useEffect, useState } from "react"
import {
  Download, FileText, Calendar,
  CheckCircle2, ChevronDown, Building2
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { getSession } from "@/shared/lib/auth"
import { useApiData } from "@/shared/lib/use-api-data"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type RangoFecha = "7d" | "30d" | "90d" | "12m"
type TipoReporte = "acreditacion" | "documentos" | "trabajadores" | "brechas"

interface ReportesData {
  cumplimiento_global: number
  total_contratistas: number
  acreditadas: number
  docs_procesados: number
  pilares: { nombre: string; cumplimiento: number }[]
  evolucion: { mes: string; aprobados: number }[]
  historial: { contratista: string; tipo: string; descripcion: string; estado: string; fecha: string }[]
  contratistas_lista: { id: string; nombre: string }[]
}

const FALLBACK: ReportesData = {
  cumplimiento_global: 0, total_contratistas: 0, acreditadas: 0, docs_procesados: 0,
  pilares: [], evolucion: [], historial: [], contratistas_lista: [],
}

// Colores por posición del pilar (el orden viene del catálogo)
const PILAR_COLORES = ["bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-emerald-500", "bg-rose-500"]

const TIPO_REPORTE_CFG: Record<TipoReporte, { label: string; color: string }> = {
  acreditacion: { label: "Acreditación", color: "bg-blue-50 text-blue-700 border-blue-200" },
  documentos:   { label: "Documentos",   color: "bg-slate-100 text-slate-600 border-slate-200" },
  trabajadores: { label: "Trabajadores", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  brechas:      { label: "Brechas",      color: "bg-red-50 text-red-700 border-red-200" },
}

const RANGOS: { value: RangoFecha; label: string }[] = [
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "90d", label: "Últimos 90 días" },
  { value: "12m", label: "Últimos 12 meses" },
]

const TIPOS_REPORTE: { value: TipoReporte; label: string; desc: string }[] = [
  { value: "acreditacion", label: "Estado de acreditación", desc: "Vista consolidada por contratista con estado de cada pilar." },
  { value: "documentos",   label: "Análisis documental",    desc: "Detalle de documentos procesados, aprobados y rechazados." },
  { value: "trabajadores", label: "Nómina de trabajadores", desc: "Listado de trabajadores y estado de cumplimiento individual." },
  { value: "brechas",      label: "Brechas y pendientes",   desc: "Informe de brechas activas ordenadas por criticidad." },
]

// ── Componentes ───────────────────────────────────────────────────────────────

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-10 text-right">{pct}%</span>
    </div>
  )
}

function EvolucionChart({ evolucion }: { evolucion: { mes: string; aprobados: number }[] }) {
  const maxH = 80
  if (!evolucion.length) return <div className="h-24 flex items-center justify-center text-xs text-slate-400">Sin datos</div>
  const max = Math.max(...evolucion.map(e => e.aprobados), 1)
  return (
    <div className="flex items-end justify-around gap-3 h-28 px-2">
      {evolucion.map(({ mes, aprobados }) => (
        <div key={mes} className="flex flex-col items-center gap-1.5 flex-1">
          <span className="text-[10px] font-medium text-slate-500">{aprobados > 0 ? aprobados : ""}</span>
          <div className="flex items-end w-full justify-center" style={{ height: maxH }}>
            <div
              className={cn("w-5 rounded-t-sm", aprobados > 0 ? "bg-emerald-500" : "bg-slate-100")}
              style={{ height: `${Math.max((aprobados / max) * maxH, 3)}px` }}
            />
          </div>
          <span className="text-[10px] text-slate-400">{mes}</span>
        </div>
      ))}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const [rango, setRango] = useState<RangoFecha>("30d")
  const [contratista, setContratista] = useState("todos")
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoReporte>("acreditacion")
  const [endpoint, setEndpoint] = useState<string | null>(null)

  useEffect(() => {
    const s = getSession()
    if (s?.mandante_id) setEndpoint(`/api/v1/mandantes/${s.mandante_id}/reportes`)
  }, [])

  const { data } = useApiData<ReportesData>(endpoint, FALLBACK)

  const contratistasLista = [
    { id: "todos", label: "Todos los contratistas" },
    ...data.contratistas_lista.map(c => ({ id: c.id, label: c.nombre })),
  ]

  const resumenActual = [
    { label: "Contratistas evaluados", value: data.total_contratistas, color: "text-slate-900" },
    { label: "Tasa de acreditación",   value: `${data.cumplimiento_global}%`, color: "text-emerald-600" },
    { label: "Documentos procesados",  value: data.docs_procesados, color: "text-blue-600" },
    { label: "Brechas activas", value: data.historial.filter(h => h.estado === "warn").length, color: "text-red-600" },
  ]

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Reportes</h1>
            <p className="text-sm text-slate-500 mt-0.5">Genera y descarga informes de acreditación</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Selector contratista */}
            <div className="relative">
              <Building2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={contratista}
                onChange={e => setContratista(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer max-w-[220px]"
              >
                {contratistasLista.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {/* Selector de rango */}
            <div className="relative">
              <select
                value={rango}
                onChange={e => setRango(e.target.value as RangoFecha)}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
              >
                {RANGOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
        {/* Banner contratista seleccionado */}
        {contratista !== "todos" && (
          <div className="mt-3 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <Building2 size={12} />
            Filtrando por: <span className="font-semibold">{contratistasLista.find(c => c.id === contratista)?.label ?? ""}</span>
            <button onClick={() => setContratista("todos")} className="ml-auto text-blue-500 hover:text-blue-700 font-medium">Ver todos →</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">

        {/* KPI resumen */}
        <div className="grid grid-cols-4 gap-4">
          {resumenActual.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
              <p className={cn("text-3xl font-semibold mt-1", k.color)}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Fila: Evolución + Pilares */}
        <div className="grid grid-cols-5 gap-6">
          {/* Evolución mensual */}
          <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Evolución de acreditación</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-slate-200" />
                  <span className="text-xs text-slate-400">Total</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span className="text-xs text-slate-400">Acreditadas</span>
                </div>
              </div>
            </div>
            <EvolucionChart evolucion={data.evolucion} />
          </div>

          {/* Cumplimiento por pilar */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Cumplimiento por pilar</h2>
            <div className="space-y-4">
              {data.pilares.map((p, i) => (
                <div key={p.nombre}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-slate-700">{p.nombre}</span>
                    <span className="text-xs font-semibold text-slate-500">{p.cumplimiento}%</span>
                  </div>
                  <MiniBar pct={p.cumplimiento} color={PILAR_COLORES[i % PILAR_COLORES.length]} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Generar nuevo reporte */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Generar nuevo reporte</h2>
            <p className="text-xs text-slate-400 mt-0.5">Selecciona el tipo y descarga en PDF o Excel</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-3 mb-5">
              {TIPOS_REPORTE.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTipoSeleccionado(t.value)}
                  className={cn(
                    "text-left p-4 rounded-lg border transition-colors",
                    tipoSeleccionado === t.value
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText size={13} className={tipoSeleccionado === t.value ? "text-slate-900" : "text-slate-400"} />
                    <p className={cn("text-sm font-medium", tipoSeleccionado === t.value ? "text-slate-900" : "text-slate-600")}>
                      {t.label}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">{t.desc}</p>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                disabled
                title="La exportación a PDF/Excel aún no está disponible"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed"
              >
                <Download size={14} />
                Exportar PDF
              </button>
              <p className="text-xs text-slate-400">La exportación de informes estará disponible próximamente.</p>
            </div>
          </div>
        </div>

        {/* Historial */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Historial de reportes</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.historial.length === 0 && (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">Sin historial de actividad</p>
            )}
            {data.historial.map((r, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  r.estado === "ok" ? "bg-emerald-50" : "bg-red-50"
                )}>
                  <FileText size={14} className={r.estado === "ok" ? "text-emerald-500" : "text-red-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{r.contratista}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{r.descripcion}</p>
                </div>
                <span className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded border shrink-0",
                  r.estado === "ok"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-700 border-red-200"
                )}>
                  {r.tipo}
                </span>
                <span className="text-xs text-slate-400 shrink-0">{r.fecha}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
