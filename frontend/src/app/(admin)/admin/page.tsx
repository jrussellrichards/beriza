"use client"

import {
  Building2, Users, FileText, CheckCircle2,
  ArrowUpRight, TrendingUp, ChevronRight, Activity
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useApiData } from "@/shared/lib/use-api-data"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AdminStats {
  total_mandantes: number; total_contratistas: number
  docs_procesados: number; tasa_acreditacion: number
}

interface AdminMandante {
  id: string; razon_social: string; rut: string; plan: string; activo: boolean
  total_contratistas: number; acreditadas: number; pct_acreditacion: number
}

interface Actividad {
  mandante: string; accion: string; tiempo: string; tipo: string
}

const PLAN_CFG: Record<string, string> = {
  Enterprise: "bg-amber-50 text-amber-700 border-amber-200",
  Pro:        "bg-blue-50 text-blue-700 border-blue-200",
}

const TIPO_CFG = {
  ok:   { dot: "bg-emerald-500" },
  warn: { dot: "bg-red-500" },
  info: { dot: "bg-blue-400" },
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { data: stats } = useApiData<AdminStats>("/api/v1/admin/stats",
    { total_mandantes: 0, total_contratistas: 0, docs_procesados: 0, tasa_acreditacion: 0 })
  const { data: mandantes } = useApiData<AdminMandante[]>("/api/v1/admin/mandantes", [])
  const { data: actividad } = useApiData<Actividad[]>("/api/v1/admin/actividad", [])

  const pct = Math.round(stats.tasa_acreditacion)
  const totalAcreditadas = mandantes.reduce((s, m) => s + m.acreditadas, 0)
  const totalContratistas = stats.total_contratistas

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Dashboard BERISA</h1>
            <p className="text-sm text-slate-500 mt-0.5">Visión global de la plataforma</p>
          </div>
          <a
            href="/admin/mandantes"
            className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Gestionar mandantes
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">

        {/* KPI */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Mandantes activos",        value: stats.total_mandantes,    sub: "empresas en plataforma",    color: "text-slate-900",   icon: Building2    },
            { label: "Contratistas totales",      value: totalContratistas,        sub: "en todos los mandantes",    color: "text-blue-600",    icon: Users        },
            { label: "Documentos procesados",     value: stats.docs_procesados,    sub: "aprobados u observados",    color: "text-purple-600",  icon: FileText     },
            { label: "Tasa global acreditación",  value: `${pct}%`,               sub: "promedio entre mandantes",  color: "text-emerald-600", icon: CheckCircle2 },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Icon size={13} className="text-slate-500" />
                  </div>
                </div>
                <p className={cn("text-3xl font-semibold", k.color)}>{k.value}</p>
                <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
              </div>
            )
          })}
        </div>

        {/* Fila central */}
        <div className="grid grid-cols-5 gap-6">

          {/* Mandantes */}
          <div className="col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900">Mandantes</h2>
              </div>
              <a href="/admin/mandantes" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Ver todos →</a>
            </div>
            <div className="divide-y divide-slate-100">
              {mandantes.map(m => {
                const color = m.pct_acreditacion >= 75 ? "bg-emerald-500" : m.pct_acreditacion >= 50 ? "bg-amber-400" : "bg-red-400"
                return (
                  <div key={m.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/60 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {initials(m.razon_social)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{m.razon_social}</p>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0", PLAN_CFG[m.plan] ?? "bg-slate-100 text-slate-500 border-slate-200")}>
                          {m.plan}
                        </span>
                        {!m.activo && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-slate-100 text-slate-400 border-slate-200 shrink-0">Inactivo</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
                          <div className={cn("h-full rounded-full", color)} style={{ width: `${m.pct_acreditacion}%` }} />
                        </div>
                        <span className="text-xs text-slate-400">{m.acreditadas}/{m.total_contratistas} acreditados</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 shrink-0" />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Gauge global */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={14} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Acreditación global</h2>
            </div>

            <div className="flex items-center justify-center flex-1 py-2">
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke={pct >= 70 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="12"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-3xl font-bold text-slate-900">{pct}%</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">acreditados</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 text-center">
                <p className="text-lg font-semibold text-emerald-600">{totalAcreditadas}</p>
                <p className="text-[10px] text-slate-400">Acreditados</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 text-center">
                <p className="text-lg font-semibold text-slate-600">{totalContratistas - totalAcreditadas}</p>
                <p className="text-[10px] text-slate-400">Pendientes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actividad */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity size={14} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Actividad reciente — todos los mandantes</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {actividad.map((a, i) => {
              const c = TIPO_CFG[a.tipo as keyof typeof TIPO_CFG] ?? TIPO_CFG.info
              return (
                <div key={i} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />
                  <span className="text-xs font-semibold text-slate-400 w-32 shrink-0">{a.mandante}</span>
                  <p className="text-sm text-slate-700 flex-1">{a.accion}</p>
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
