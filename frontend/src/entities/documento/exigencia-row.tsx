"use client"

import { useState } from "react"
import { AlertCircle, ChevronDown, ChevronRight, FileText, History, Upload } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { type Exigencia, type EstadoDoc, estadoDe, ESTADO_CFG, formatFecha } from "./exigencia"

export function EstadoBadge({ estado }: { estado: EstadoDoc }) {
  const c = ESTADO_CFG[estado] ?? ESTADO_CFG.FALTA
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", c.bg, c.border, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  )
}

/**
 * Fila de un requisito exigido con su propio estado (uno por requisito, no
 * uno por pilar) -- fuente compartida entre la página de Documentos (donde
 * se gestiona: subir/resubir/historial) y el dashboard del contratista
 * (solo lectura -- omite onSubir/onHistorial para no duplicar la gestión).
 */
export function ExigenciaRow({ item, onSubir, onHistorial }: {
  item: Exigencia
  onSubir?: (e: Exigencia) => void
  onHistorial?: (e: Exigencia) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const estado = estadoDe(item)
  const tieneBrecha = estado === "OBSERVADO" && !!item.mensaje_brecha
  const vence = formatFecha(item.fecha_vigencia_hasta)

  return (
    <div className={cn(
      "rounded-lg border transition-colors",
      tieneBrecha ? "border-red-200 bg-red-50/30" : "border-slate-100 bg-white"
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        <FileText size={14} className="text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-900">{item.requisito_nombre}</p>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">
              {item.requisito_codigo}
            </span>
            {item.trabajador_nombre && (
              <span className="text-[10px] text-slate-500 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                {item.trabajador_nombre}
              </span>
            )}
            {item.servicio_nombre && (
              <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                Servicio: {item.servicio_nombre}
              </span>
            )}
          </div>
          {vence && <p className="text-xs text-slate-400 mt-0.5">Vence: {vence}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <EstadoBadge estado={estado} />
          {onSubir && (estado === "OBSERVADO" || estado === "FALTA" || estado === "APROBADO") && (
            <button
              onClick={() => onSubir(item)}
              className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <Upload size={12} />
              {estado === "FALTA" ? "Subir" : estado === "APROBADO" ? "Renovar" : "Resubir"}
            </button>
          )}
          {onHistorial && item.documento_id && (
            <button
              onClick={() => onHistorial(item)}
              title="Ver historial del expediente"
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <History size={13} />
            </button>
          )}
          {tieneBrecha && (
            <button
              onClick={() => setExpandido(!expandido)}
              className="p-1.5 rounded-md hover:bg-red-100 text-red-400 transition-colors"
            >
              {expandido ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}
        </div>
      </div>

      {tieneBrecha && expandido && (
        <div className="mx-4 mb-3 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-800 mb-0.5">Motivo de observación</p>
              <p className="text-xs text-red-700">{item.mensaje_brecha}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
