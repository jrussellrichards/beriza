"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle2, Clock, XCircle, AlertCircle,
  ChevronRight, TrendingUp, ArrowUpRight
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { getSession } from "@/shared/lib/auth"
import { useApiData } from "@/shared/lib/use-api-data"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  total_contratistas: number
  acreditadas: number
  en_proceso: number
  bloqueadas: number
  pilares: { codigo: string; nombre: string; ok: number; total: number; cumplimiento: number }[]
  alertas: { contratista: string; rut: string; estado: string; brechas: string[] }[]
  actividad: { empresa: string; accion: string; tiempo: string; tipo: string }[]
}

const FALLBACK: DashboardData = {
  total_contratistas: 0, acreditadas: 0, en_proceso: 0, bloqueadas: 0,
  pilares: [], alertas: [], actividad: [],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

function PilarBar({ nombre, ok, total }: { nombre: string; ok: number; total: number }) {
  const pct = total > 0 ? Math.round((ok / total) * 100) : 0
  const color = pct === 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400"
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-700 font-medium">{nombre}</span>
        <span className="text-xs text-slate-500">{ok}/{total} OK</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-400">{pct}% de contratistas cumplen</p>
    </div>
  )
}

const TIPO_CONFIG = {
  ok:   { dot: "bg-emerald-500", text: "text-emerald-700" },
  warn: { dot: "bg-red-500",     text: "text-red-600" },
  info: { dot: "bg-blue-400",    text: "text-slate-500" },
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function DashboardMandante() {
  const [endpoint, setEndpoint] = useState<string | null>(null)

  useEffect(() => {
    const s = getSession()
    if (s?.mandante_id) setEndpoint(`/api/v1/mandantes/${s.mandante_id}/dashboard`)
  }, [])

  const { data, loading } = useApiData<DashboardData>(endpoint, FALLBACK)

  const pctGlobal = data.total_contratistas > 0
    ? Math.round((data.acreditadas / data.total_contratistas) * 100)
    : 0

  const kpis = [
    { label: "Total contratistas", value: data.total_contratistas, sub: "empresas activas", color: "text-slate-900" },
    { label: "Acreditadas",        value: data.acreditadas, sub: `${pctGlobal}% del total`, color: "text-emerald-600" },
    { label: "En Proceso",         value: data.en_proceso,  sub: "sin acción requerida",   color: "text-amber-600" },
    { label: "Bloqueadas",         value: data.bloqueadas,  sub: "requieren atención",     color: "text-red-600" },
  ]

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Resumen general de acreditación</p>
          </div>
          <a
            href="/mandante/contratistas"
            className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Ver todos los contratistas
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
              <p className={cn("text-3xl font-semibold mt-2 mb-1", k.color)}>
                {loading ? <span className="inline-block w-8 h-7 bg-slate-100 rounded animate-pulse" /> : k.value}
              </p>
              <p className="text-xs text-slate-400">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Fila central */}
        <div className="grid grid-cols-5 gap-6">

          {/* Gauge + pilares */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Cumplimiento por pilar</h2>
              <div className="flex items-center gap-1.5">
                <TrendingUp size={13} className="text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-600">{pctGlobal}% global</span>
              </div>
            </div>
            <div className="flex items-center justify-center py-2">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke={pctGlobal >= 70 ? "#10b981" : pctGlobal >= 50 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="12"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - pctGlobal / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold text-slate-900">{pctGlobal}%</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">acreditadas</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 pt-1">
              {data.pilares.map(p => <PilarBar key={p.codigo} nombre={p.nombre} ok={p.ok} total={p.total} />)}
            </div>
          </div>

          {/* Alertas bloqueados */}
          <div className="col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="text-red-500" />
                <h2 className="text-sm font-semibold text-slate-900">Contratistas bloqueados</h2>
                <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                  {data.bloqueadas}
                </span>
              </div>
              <a href="/mandante/contratistas" className="text-xs text-slate-400 hover:text-slate-600">
                Ver todos →
              </a>
            </div>
            <div className="divide-y divide-slate-100">
              {data.alertas.length === 0 && !loading && (
                <p className="px-5 py-8 text-sm text-slate-400 text-center">Sin contratistas bloqueados</p>
              )}
              {data.alertas.map((a, i) => (
                <div key={i} className="px-5 py-4 hover:bg-slate-50/70 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-md bg-red-50 text-red-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {initials(a.contratista)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{a.contratista}</p>
                      <p className="text-xs text-slate-400 font-mono mb-2">{a.rut}</p>
                      <div className="space-y-0.5">
                        {a.brechas.map((b, j) => (
                          <p key={j} className="text-xs text-red-500 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                            {b}
                          </p>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 mt-0.5 shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Actividad reciente</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.actividad.length === 0 && !loading && (
              <p className="px-5 py-6 text-sm text-slate-400 text-center">Sin actividad reciente</p>
            )}
            {data.actividad.map((a, i) => {
              const c = TIPO_CONFIG[a.tipo as keyof typeof TIPO_CONFIG] ?? TIPO_CONFIG.info
              return (
                <div key={i} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/70">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />
                  <p className="text-sm font-medium text-slate-800 w-64 shrink-0 truncate">{a.empresa}</p>
                  <p className={cn("text-sm flex-1", c.text)}>{a.accion}</p>
                  <p className="text-xs text-slate-400 shrink-0">{a.tiempo}</p>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
