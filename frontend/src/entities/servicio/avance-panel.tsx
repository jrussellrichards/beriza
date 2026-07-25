"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, FileText, History, Loader2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { estadoDocDe, estiloDeEstado, LABEL_DOC } from "@/shared/ui/estado-badge"
import { api } from "@/shared/lib/api"
import { HistorialDialog } from "@/entities/documento/historial-dialog"
import type { AvanceServicio, RequisitoAvance } from "./types"

// Estados de documento del backend: 1=Enviado | 2=En Análisis | 3=Observado | 4=Aprobado
const PILAR_COLOR: Record<string, string> = {
  LEGAL: "bg-brand-soft text-brand-hover border-brand-line",
  HSE: "bg-accion-soft text-accion-ink border-accion-line",
  COMPLIANCE: "bg-excepcion-soft text-excepcion-ink border-excepcion-line",
}

function EstadoDocBadge({ estado }: { estado: number | null }) {
  const c = estiloDeEstado(estadoDocDe(estado))
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0", c.soft, c.line, c.ink)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {LABEL_DOC[estadoDocDe(estado)]}
    </span>
  )
}

function RequisitoRow({ r, onVerArchivos }: { r: RequisitoAvance; onVerArchivos: (r: RequisitoAvance) => void }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-surface border border-line-subtle">
      <FileText size={13} className="text-ink-subtle shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink truncate">
          {r.requisito_nombre}
          {r.trabajador_nombre && <span className="text-ink-subtle font-normal"> — {r.trabajador_nombre}</span>}
        </p>
        {r.fecha_vigencia_hasta && (
          <p className="text-[10px] text-ink-subtle">Vence: {r.fecha_vigencia_hasta}</p>
        )}
        {r.estado === 3 && r.mensaje_brecha && (
          <p className="text-[10px] text-bloqueo-ink mt-0.5 flex items-start gap-1">
            <AlertCircle size={10} className="mt-px shrink-0" />
            {r.mensaje_brecha}
          </p>
        )}
      </div>
      {r.documento_id && (
        <button
          onClick={() => onVerArchivos(r)}
          title="Ver archivos subidos"
          className="p-1 rounded-md hover:bg-surface-sunken text-ink-subtle hover:text-ink-muted transition-colors shrink-0"
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
    return <p className="text-xs text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>
  }
  if (!avance) {
    return (
      <div className="flex items-center justify-center py-10 text-ink-subtle">
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
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Avance de acreditación</p>
          <p className="text-lg font-semibold text-ink">{r.porcentaje_avance}%</p>
        </div>
        <div className="h-2 rounded-full bg-surface-sunken overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              r.porcentaje_avance === 100 ? "bg-ok-soft0" : r.observados > 0 ? "bg-bloqueo-ink" : "bg-accion-line"
            )}
            style={{ width: `${r.porcentaje_avance}%` }}
          />
        </div>
        <p className="text-[11px] text-ink-subtle mt-1.5">
          {r.aprobados} de {r.total_requisitos} documentos aprobados
        </p>
      </div>

      {/* Resumen por estado */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Aprobados", value: r.aprobados, color: "text-ok-ink" },
          { label: "Observados", value: r.observados, color: "text-bloqueo-ink" },
          { label: "En curso", value: r.en_analisis + r.enviados, color: "text-brand-hover" },
          { label: "Faltan", value: r.faltantes, color: "text-ink-muted" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-line-subtle bg-surface-app px-2 py-2 text-center">
            <p className={cn("text-base font-semibold", k.color)}>{k.value}</p>
            <p className="text-[10px] text-ink-subtle">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Pilares con requisitos */}
      <div className="space-y-4">
        {avance.pilares.map((p) => (
          <div key={p.codigo}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", PILAR_COLOR[p.codigo] ?? "bg-surface-sunken text-ink-muted border-line")}>
                {p.nombre}
              </span>
              <span className={cn("text-[10px] font-medium", p.cumple ? "text-ok-ink" : "text-ink-subtle")}>
                {p.aprobados}/{p.total}
              </span>
              {p.cumple && <CheckCircle2 size={11} className="text-ok-ink" />}
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
          <p className="text-xs text-ink-subtle italic">El perfil de este servicio no tiene requisitos configurados</p>
        )}
      </div>

      {/* Trabajadores */}
      {avance.trabajadores.length > 0 && (
        <div>
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-2">
            Dotación ({avance.trabajadores.filter((t) => t.cumple).length}/{avance.trabajadores.length} puede ingresar)
          </p>
          <div className="space-y-1.5">
            {avance.trabajadores.map((t) => (
              <div key={t.trabajador_id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-app border border-line-subtle">
                <div>
                  <p className="text-xs font-medium text-ink">{t.nombre}</p>
                  <p className="text-[10px] text-ink-subtle font-mono">{t.rut}{t.cargo ? ` · ${t.cargo}` : ""}</p>
                </div>
                <span className={cn("text-xs font-medium", t.cumple ? "text-ok-ink" : "text-bloqueo-ink")}>
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
