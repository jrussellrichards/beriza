"use client"

import { cn } from "@/shared/lib/utils"
import { ESTADO_CFG, ESTADO_NUM, type EstadoDoc } from "@/entities/documento/exigencia"
import type { EstadoPorMandante } from "@/entities/contratista/resumen"

/**
 * El estado de un mismo documento ante cada mandante que lo exige.
 *
 * Es lo que hace visible la reutilización de Fase 2: el contratista ve que su
 * F30 —uno solo— está aprobado con Codelco y en revisión con Falabella. Con la
 * vista anterior (una fila por mandante) esa relación era invisible.
 */
export function BadgesMandante({ mandantes, onSelect }: {
  mandantes: EstadoPorMandante[]
  onSelect?: (m: EstadoPorMandante) => void
}) {
  // La versión solo se muestra si los mandantes están viendo versiones
  // DISTINTAS. Es el caso confuso: uno aprobó la v1 y sigue vigente mientras
  // otro observó la v2. Si todos miran la misma, el dato solo agrega ruido.
  const versiones = new Set(mandantes.map(m => m.numero_version).filter(v => v !== null))
  const versionesDistintas = versiones.size > 1

  return (
    <div className="flex flex-wrap gap-1.5">
      {mandantes.map(m => {
        const estado: EstadoDoc = m.estado ? ESTADO_NUM[m.estado] ?? "FALTA" : "FALTA"
        const c = ESTADO_CFG[estado]
        const clickable = onSelect !== undefined && m.documento_id !== null
        return (
          <button
            key={m.mandante_id}
            onClick={clickable ? () => onSelect(m) : undefined}
            disabled={!clickable}
            title={m.mensaje_brecha ?? undefined}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors",
              c.bg, c.border, c.text,
              clickable ? "cursor-pointer hover:brightness-95" : "cursor-default"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
            <span className="font-semibold">{m.mandante_razon_social}</span>
            <span className="opacity-70">·</span>
            <span>{c.label.toLowerCase()}</span>
            {m.numero_version !== null && versionesDistintas && (
              <span className="opacity-60 tabular-nums">v{m.numero_version}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
