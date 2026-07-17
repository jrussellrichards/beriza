"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, FileText, History, Loader2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { HistorialDialog } from "@/entities/documento/historial-dialog"
import type { AvanceServicio, RequisitoAvance } from "./types"

// Estados de documento del backend: 1=Enviado | 2=En Análisis | 3=Observado | 4=Aprobado
const ESTADO_DOC_CFG: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  "4":    { label: "Aprobado",    dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  "3":    { label: "Observado",   dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200" },
  "2":    { label: "En análisis", dot: "bg-blue-500",    text: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  "1":    { label: "Enviado",     dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  "null": { label: "Falta",       dot: "bg-slate-300",   text: "text-slate-500",   bg: "bg-slate-50",   border: "border-slate-200" },
}

const PILAR_COLOR: Record<string, string> = {
  LEGAL: "bg-blue-50 text-blue-700 border-blue-200",
  HSE: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLIANCE: "bg-purple-50 text-purple-700 border-purple-200",
}

function EstadoDocBadge({ estado }: { estado: number | null }) {
  const c = ESTADO_DOC_CFG[String(estado)] ?? ESTADO_DOC_CFG["null"]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0", c.bg, c.border, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  )
}

function RequisitoRow({ r, onVerArchivos }: { r: RequisitoAvance; onVerArchivos: (r: RequisitoAvance) => void }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white border border-slate-100">
      <FileText size={13} className="text-slate-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">
          {r.requisito_nombre}
          {r.trabajador_nombre && <span className="text-slate-400 font-normal"> — {r.trabajador_nombre}</span>}
        </p>
        {r.fecha_vigencia_hasta && (
          <p className="text-[10px] text-slate-400">Vence: {r.fecha_vigencia_hasta}</p>
        )}
        {r.estado === 3 && r.mensaje_brecha && (
          <p className="text-[10px] text-red-600 mt-0.5 flex items-start gap-1">
            <AlertCircle size={10} className="mt-px shrink-0" />
            {r.mensaje_brecha}
          </p>
        )}
      </div>
      {r.documento_id && (
        <button
          onClick={() => onVerArchivos(r)}
          title="Ver archivos subidos"
          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
        >
          <History size={13} />
        </button>
      )}
      <EstadoDocBadge estado={r.estado} />
    </div>
  )
}

export function AvancePanel({ servicioId }: { servicioId: string }) {
  const [avance, setAvance] = useState<AvanceServicio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [historialItem, setHistorialItem] = useState<RequisitoAvance | null>(null)

  useEffect(() => {
    setAvance(null)
    setError(null)
    api.get<AvanceServicio>(`/api/v1/servicios/${servicioId}/avance`)
      .then(setAvance)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar avance"))
  }, [servicioId])

  if (error) {
    return <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
  }
  if (!avance) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-400">
        <Loader2 size={18} className="animate-spin" />
      </div>
    )
  }

  const r = avance.resumen
  return (
    <div className="space-y-5">
      {/* Barra de progreso */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avance de acreditación</p>
          <p className="text-lg font-semibold text-slate-900">{r.porcentaje_avance}%</p>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              r.porcentaje_avance === 100 ? "bg-emerald-500" : r.observados > 0 ? "bg-red-400" : "bg-amber-400"
            )}
            style={{ width: `${r.porcentaje_avance}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          {r.aprobados} de {r.total_requisitos} documentos aprobados
        </p>
      </div>

      {/* Resumen por estado */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Aprobados", value: r.aprobados, color: "text-emerald-600" },
          { label: "Observados", value: r.observados, color: "text-red-600" },
          { label: "En curso", value: r.en_analisis + r.enviados, color: "text-blue-600" },
          { label: "Faltan", value: r.faltantes, color: "text-slate-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2 text-center">
            <p className={cn("text-base font-semibold", k.color)}>{k.value}</p>
            <p className="text-[10px] text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Pilares con requisitos */}
      <div className="space-y-4">
        {avance.pilares.map((p) => (
          <div key={p.codigo}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", PILAR_COLOR[p.codigo] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                {p.nombre}
              </span>
              <span className={cn("text-[10px] font-medium", p.cumple ? "text-emerald-600" : "text-slate-400")}>
                {p.aprobados}/{p.total}
              </span>
              {p.cumple && <CheckCircle2 size={11} className="text-emerald-500" />}
            </div>
            <div className="space-y-1.5">
              {p.requisitos.map((req, i) => (
                <RequisitoRow
                  key={`${req.requisito_id}-${req.trabajador_id ?? "empresa"}-${i}`}
                  r={req}
                  onVerArchivos={setHistorialItem}
                />
              ))}
            </div>
          </div>
        ))}
        {avance.pilares.length === 0 && (
          <p className="text-xs text-slate-400 italic">El perfil de este servicio no tiene requisitos configurados</p>
        )}
      </div>

      {/* Trabajadores */}
      {avance.trabajadores.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Dotación ({avance.trabajadores.filter((t) => t.cumple).length}/{avance.trabajadores.length} al día)
          </p>
          <div className="space-y-1.5">
            {avance.trabajadores.map((t) => (
              <div key={t.trabajador_id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-xs font-medium text-slate-800">{t.nombre}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{t.rut}{t.cargo ? ` · ${t.cargo}` : ""}</p>
                </div>
                <span className={cn("text-xs font-medium", t.cumple ? "text-emerald-600" : "text-amber-600")}>
                  {t.aprobados}/{t.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {historialItem?.documento_id && (
        <HistorialDialog
          documentoId={historialItem.documento_id}
          titulo={
            historialItem.trabajador_nombre
              ? `${historialItem.requisito_nombre} — ${historialItem.trabajador_nombre}`
              : historialItem.requisito_nombre
          }
          onClose={() => setHistorialItem(null)}
        />
      )}
    </div>
  )
}
