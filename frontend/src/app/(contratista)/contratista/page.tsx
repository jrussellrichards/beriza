"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2, Clock, XCircle,
  ChevronDown, ChevronRight, Users, Plus, Building2, ArrowRight,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { getSession } from "@/shared/lib/auth"
import { api } from "@/shared/lib/api"
import { useAcreditacion } from "@/entities/contratista/use-acreditacion"
import { type Exigencia } from "@/entities/documento/exigencia"
import { ExigenciaRow } from "@/entities/documento/exigencia-row"
import type { EstadoTrabajador } from "@/shared/types"

// ── Config visual ────────────────────────────────────────────────────────────

const ESTADO_CONFIG = {
  PENDIENTE: {
    label: "Pendiente",
    icon: Clock,
    iconColor: "text-slate-400",
    border: "border-slate-200",
    bg: "bg-slate-50",
    dot: "bg-slate-400",
    text: "text-slate-600",
    badgeBg: "bg-slate-50 border-slate-200",
  },
  ACREDITADA: {
    label: "Acreditada",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    badgeBg: "bg-emerald-50 border-emerald-200",
  },
  EN_PROCESO: {
    label: "En Proceso",
    icon: Clock,
    iconColor: "text-amber-500",
    border: "border-amber-200",
    bg: "bg-amber-50",
    dot: "bg-amber-500",
    text: "text-amber-700",
    badgeBg: "bg-amber-50 border-amber-200",
  },
  BLOQUEADA: {
    label: "Bloqueada",
    icon: XCircle,
    iconColor: "text-red-500",
    border: "border-red-200",
    bg: "bg-red-50",
    dot: "bg-red-500",
    text: "text-red-700",
    badgeBg: "bg-red-50 border-red-200",
  },
}

// ── Componentes pequeños ─────────────────────────────────────────────────────

function EstadoTag({ estado }: { estado: keyof typeof ESTADO_CONFIG }) {
  const c = ESTADO_CONFIG[estado]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", c.badgeBg, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  )
}

function VerEnDocumentos() {
  return (
    <button
      onClick={() => window.location.href = "/contratista/documentos"}
      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
    >
      Gestionar en Documentos <ArrowRight size={12} />
    </button>
  )
}

function TrabajadorRow({ trabajador, items }: {
  trabajador: EstadoTrabajador
  items: Exigencia[]
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn("rounded-xl border overflow-hidden transition-colors", expanded ? "border-slate-300" : "border-slate-200")}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
            {trabajador.nombre.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-900">{trabajador.nombre}</p>
            <p className="text-xs text-slate-400 font-mono">{trabajador.rut}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <EstadoTag estado={trabajador.cumple ? "ACREDITADA" : "EN_PROCESO"} />
          {expanded
            ? <ChevronDown size={14} className="text-slate-400" />
            : <ChevronRight size={14} className="text-slate-400" />
          }
        </div>
      </button>

      {expanded && (
        <div className="space-y-1.5 px-4 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100">
          {items.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Sin documentos exigidos para este trabajador todavía.</p>
          ) : (
            items.map((i, idx) => (
              <ExigenciaRow key={`${i.requisito_id}-${i.servicio_id ?? "e"}-${idx}`} item={i} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-slate-200 rounded-lg", className)} />
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function DashboardContratistaPage() {
  const [session, setSession] = useState<{ contratista_id: string; mandante_id: string } | null>(null)
  const [exigencias, setExigencias] = useState<Exigencia[]>([])

  useEffect(() => {
    const s = getSession()
    if (s) setSession(s)
  }, [])

  const { data, loading, error } = useAcreditacion(
    session?.contratista_id ?? "",
    session?.mandante_id ?? ""
  )

  const cargarExigencias = useCallback(() => {
    if (!session?.contratista_id || !session?.mandante_id) return
    api.get<Exigencia[]>(`/api/v1/acreditacion/${session.contratista_id}/mandante/${session.mandante_id}/exigencias`)
      .then(setExigencias)
      .catch(() => setExigencias([]))
  }, [session])

  useEffect(() => { cargarExigencias() }, [cargarExigencias])

  if (!session || loading) return <LoadingState />
  if (error || !data) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm font-medium text-red-800">No se pudo cargar tu estado de acreditación</p>
          <p className="text-xs text-red-600 mt-1">{error ?? "Intenta recargar la página."}</p>
        </div>
      </div>
    )
  }

  const cfg = ESTADO_CONFIG[data.estado_global]
  const Icon = cfg.icon
  const trabajadoresOk = data.trabajadores.filter(t => t.cumple).length
  const itemsEmpresa = exigencias.filter(e => !e.trabajador_id)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mi Acreditación</h1>
          <p className="text-sm text-slate-500 mt-0.5">Estado de cumplimiento ante el mandante</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">

        {/* Banner estado global */}
        <div className={cn("rounded-xl border p-5 flex items-center gap-4", cfg.bg, cfg.border)}>
          <Icon size={36} className={cfg.iconColor} />
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <p className="text-base font-semibold text-slate-900">Estado global de acreditación</p>
              <EstadoTag estado={data.estado_global} />
            </div>
            <p className="text-sm text-slate-500">
              {data.estado_global === "ACREDITADA"
                ? "Tu empresa cumple todos los requisitos exigidos. Los trabajadores pueden ingresar a la faena."
                : data.estado_global === "BLOQUEADA"
                  ? "Hay brechas críticas que impiden el acceso a la obra. Corrígelas lo antes posible."
                  : data.estado_global === "PENDIENTE"
                    ? "Aún no tienes servicios activos con este mandante — no hay requisitos exigibles todavía."
                    : "Hay documentos pendientes o en revisión. El acceso está condicionado."
              }
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-400 mb-1">Trabajadores OK</p>
            <p className={cn("text-2xl font-semibold", trabajadoresOk === data.trabajadores.length ? "text-emerald-600" : "text-amber-600")}>
              {trabajadoresOk}/{data.trabajadores.length}
            </p>
          </div>
        </div>

        {/* Documentos empresa — solo lectura, gestión en /contratista/documentos */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Documentos — Empresa</h2>
            </div>
            <VerEnDocumentos />
          </div>
          <div className="space-y-1.5">
            {itemsEmpresa.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                <p className="text-sm text-slate-400">No hay documentos de empresa exigidos todavía.</p>
              </div>
            ) : (
              itemsEmpresa.map((i, idx) => (
                <ExigenciaRow key={`${i.requisito_id}-${i.servicio_id ?? "e"}-${idx}`} item={i} />
              ))
            )}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Trabajadores */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Trabajadores ({data.trabajadores.length})
              </h2>
            </div>
            <button
              onClick={() => window.location.href = "/contratista/trabajadores"}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              Ver todos →
            </button>
          </div>

          {data.trabajadores.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
              <Users size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-3">No hay trabajadores registrados</p>
              <button
                onClick={() => window.location.href = "/contratista/trabajadores"}
                className="flex items-center gap-2 mx-auto bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Plus size={14} />
                Agregar trabajador
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {data.trabajadores.map(t => (
                <TrabajadorRow
                  key={t.trabajador_id}
                  trabajador={t}
                  items={exigencias.filter(e => e.trabajador_id === t.trabajador_id)}
                />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
