"use client"

import { useState, useEffect } from "react"
import {
  ChevronDown, ChevronRight, CheckCircle2,
  Circle, Info, Save, Lock
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useApiData } from "@/shared/lib/use-api-data"
import { getSession } from "@/shared/lib/auth"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Requisito {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  entidad: "EMPRESA" | "TRABAJADOR"
  es_obligatorio: boolean
  vigencia_max_dias: number
  umbral_deuda_max?: number
}

interface Pilar {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  color: string
  requisitos: Requisito[]
}

const COLOR_MAP: Record<string, { border: string; bg: string; dot: string; text: string; badge: string }> = {
  blue:   { border: "border-blue-200",   bg: "bg-blue-50",   dot: "bg-blue-500",   text: "text-blue-700",   badge: "bg-blue-50 text-blue-700 border-blue-200" },
  amber:  { border: "border-amber-200",  bg: "bg-amber-50",  dot: "bg-amber-500",  text: "text-amber-700",  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  purple: { border: "border-purple-200", bg: "bg-purple-50", dot: "bg-purple-500", text: "text-purple-700", badge: "bg-purple-50 text-purple-700 border-purple-200" },
}

// ── Componentes ───────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-slate-900" : "bg-slate-200"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  )
}

function RequisitoRow({
  req,
  color,
  onChange,
}: {
  req: Requisito
  color: string
  onChange: (id: string, field: keyof Requisito, value: unknown) => void
}) {
  const [editing, setEditing] = useState(false)
  const c = COLOR_MAP[color]

  return (
    <div className={cn(
      "rounded-lg border p-4 transition-colors",
      req.es_obligatorio ? "bg-white border-slate-200" : "bg-slate-50/60 border-slate-100"
    )}>
      <div className="flex items-start gap-3">
        {/* Toggle obligatorio */}
        <div className="mt-0.5">
          <Toggle
            checked={req.es_obligatorio}
            onChange={v => onChange(req.id, "es_obligatorio", v)}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className={cn("text-sm font-semibold", req.es_obligatorio ? "text-slate-900" : "text-slate-400")}>
              {req.nombre}
            </p>
            <span className={cn(
              "text-[10px] font-mono px-1.5 py-0.5 rounded border",
              req.es_obligatorio ? c.badge : "bg-slate-100 text-slate-400 border-slate-200"
            )}>
              {req.codigo}
            </span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded border font-medium",
              req.entidad === "EMPRESA"
                ? "bg-slate-100 text-slate-500 border-slate-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            )}>
              {req.entidad === "EMPRESA" ? "Empresa" : "Trabajador"}
            </span>
          </div>
          <p className={cn("text-xs mb-3", req.es_obligatorio ? "text-slate-500" : "text-slate-400")}>
            {req.descripcion}
          </p>

          {/* Parámetros */}
          {req.es_obligatorio && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 whitespace-nowrap">Vigencia máx.</label>
                {editing ? (
                  <input
                    type="number"
                    value={req.vigencia_max_dias}
                    onChange={e => onChange(req.id, "vigencia_max_dias", Number(e.target.value))}
                    className="w-16 text-xs border border-slate-300 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                ) : (
                  <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                    {req.vigencia_max_dias} días
                  </span>
                )}
              </div>

              {req.umbral_deuda_max !== undefined && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 whitespace-nowrap">Deuda máx.</label>
                  {editing ? (
                    <input
                      type="number"
                      value={req.umbral_deuda_max}
                      onChange={e => onChange(req.id, "umbral_deuda_max", Number(e.target.value))}
                      className="w-24 text-xs border border-slate-300 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  ) : (
                    <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                      ${(req.umbral_deuda_max ?? 0).toLocaleString("es-CL")}
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={() => setEditing(!editing)}
                className={cn(
                  "text-xs px-2 py-1 rounded transition-colors flex items-center gap-1",
                  editing
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                )}
              >
                {editing ? <><Save size={11} /> Guardar</> : "Editar parámetros"}
              </button>
            </div>
          )}
        </div>

        {req.es_obligatorio
          ? <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />
          : <Circle size={15} className="text-slate-300 mt-0.5 shrink-0" />
        }
      </div>
    </div>
  )
}

function PilarSection({ pilar, onChange }: {
  pilar: Pilar
  onChange: (pilarId: string, reqId: string, field: keyof Requisito, value: unknown) => void
}) {
  const [open, setOpen] = useState(true)
  const c = COLOR_MAP[pilar.color]
  const obligatorios = pilar.requisitos.filter(r => r.es_obligatorio).length
  const empresa = pilar.requisitos.filter(r => r.entidad === "EMPRESA").length
  const trabajador = pilar.requisitos.filter(r => r.entidad === "TRABAJADOR").length

  return (
    <div className={cn("rounded-xl border overflow-hidden", c.border)}>
      {/* Header del pilar */}
      <button
        onClick={() => setOpen(!open)}
        className={cn("w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:opacity-90", c.bg)}
      >
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", c.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <p className={cn("text-sm font-bold", c.text)}>{pilar.nombre}</p>
            <span className="text-xs text-slate-500">{pilar.descripcion}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500">
            {obligatorios}/{pilar.requisitos.length} activos
          </span>
          {empresa > 0 && (
            <span className="text-[10px] bg-white/70 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
              {empresa} empresa
            </span>
          )}
          {trabajador > 0 && (
            <span className="text-[10px] bg-white/70 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
              {trabajador} trabajador
            </span>
          )}
          {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
        </div>
      </button>

      {/* Requisitos */}
      {open && (
        <div className="p-4 space-y-2 bg-white">
          {pilar.requisitos.map(req => (
            <RequisitoRow
              key={req.id}
              req={req}
              color={pilar.color}
              onChange={(reqId, field, value) => onChange(pilar.id, reqId, field, value)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function RequisitosPage() {
  const [endpoint, setEndpoint] = useState<string | null>(null)
  useEffect(() => {
    const s = getSession()
    if (s?.mandante_id) setEndpoint(`/api/v1/mandantes/${s.mandante_id}/requisitos`)
  }, [])

  const { data: apiPilares } = useApiData<Pilar[]>(endpoint, [])
  const [pilares, setPilares] = useState<Pilar[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (apiPilares.length > 0) setPilares(apiPilares)
  }, [apiPilares])

  function handleChange(pilarId: string, reqId: string, field: keyof Requisito, value: unknown) {
    setSaved(false)
    setPilares(prev => prev.map(p =>
      p.id !== pilarId ? p : {
        ...p,
        requisitos: p.requisitos.map(r => r.id !== reqId ? r : { ...r, [field]: value })
      }
    ))
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const totalActivos = pilares.flatMap(p => p.requisitos).filter(r => r.es_obligatorio).length
  const totalRequisitos = pilares.flatMap(p => p.requisitos).length

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Requisitos</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Configura qué documentos exiges y con qué parámetros — se aplica a todos tus contratistas
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
              <Lock size={12} className="text-slate-400" />
              Los pilares los gestiona BERISA
            </div>
            <button
              onClick={handleSave}
              className={cn(
                "flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all",
                saved
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              <Save size={14} />
              {saved ? "¡Guardado!" : "Guardar cambios"}
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            Tienes <strong>{totalActivos} de {totalRequisitos} requisitos activos</strong>.
            Los requisitos desactivados no aparecerán en el checklist de tus contratistas.
            Los cambios afectan a todos los contratistas actuales y futuros.
          </p>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto px-8 py-6 space-y-5">
        {pilares.map(pilar => (
          <PilarSection
            key={pilar.id}
            pilar={pilar}
            onChange={handleChange}
          />
        ))}
      </div>
    </div>
  )
}
