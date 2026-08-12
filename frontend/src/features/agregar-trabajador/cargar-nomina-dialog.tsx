"use client"

import { useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"

interface FilaError {
  fila: number
  rut: string
  nombre: string
  motivo: string
}

interface ReporteImportacion {
  filas_leidas: number
  cargados: number
  ya_existian: number
  con_error: number
  errores: FilaError[]
}

/**
 * Carga masiva de la nómina desde CSV o Excel.
 *
 * El diálogo tiene dos estados y no tres: elegir archivo, y ver el reporte. No
 * hay pantalla de "confirmar antes de cargar" porque la importación es parcial
 * —las filas buenas entran, las malas se informan— así que no hay nada que
 * confirmar: el reporte ES la confirmación.
 *
 * "Ya existían" se muestra aparte de los errores a propósito. Corregir tres
 * filas y volver a subir el mismo archivo es el flujo normal, y pintar 77
 * duplicados en rojo haría creer que algo se rompió.
 */
export function CargarNominaDialog({ onClose, onCargado }: {
  onClose: () => void
  /** Se llama cuando entró al menos un trabajador, para refrescar la lista. */
  onCargado: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reporte, setReporte] = useState<ReporteImportacion | null>(null)

  async function descargarPlantilla() {
    setDescargando(true)
    setError(null)
    try {
      await api.descargar("/api/v1/trabajadores/plantilla-nomina", "plantilla-nomina.csv")
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar la plantilla")
    } finally {
      setDescargando(false)
    }
  }

  async function subir() {
    if (!archivo) return
    setSubiendo(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("archivo", archivo)
      const r = await api.upload<ReporteImportacion>("/api/v1/trabajadores/cargar-nomina", form)
      setReporte(r)
      if (r.cargados > 0) onCargado()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el archivo")
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-surface-inverse/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-line-subtle flex items-center justify-between">
          <div>
            <p className="text-strong font-semibold text-ink">Cargar nómina</p>
            <p className="text-meta text-ink-subtle mt-0.5">
              Sube tu lista de trabajadores en un archivo, en vez de uno por uno
            </p>
          </div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted"><X size={16} /></button>
        </div>

        {reporte ? (
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { n: reporte.cargados, label: "cargados", tono: "ok" },
                { n: reporte.ya_existian, label: "ya estaban", tono: "espera" },
                { n: reporte.con_error, label: "con error", tono: reporte.con_error > 0 ? "accion" : "espera" },
              ].map(k => (
                <div key={k.label} className={cn(
                  "rounded-lg border px-3 py-2.5 text-center",
                  k.tono === "ok" ? "bg-ok-soft border-ok-line"
                    : k.tono === "accion" ? "bg-accion-soft border-accion-line"
                    : "bg-surface-app border-line",
                )}>
                  <p className={cn(
                    "text-title font-semibold",
                    k.tono === "ok" ? "text-ok-ink" : k.tono === "accion" ? "text-accion-ink" : "text-ink-muted",
                  )}>{k.n}</p>
                  <p className="text-[10px] text-ink-subtle mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {reporte.con_error === 0 ? (
              <p className="text-body text-ok-ink bg-ok-soft border border-ok-line rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckCircle2 size={14} className="shrink-0" />
                Se leyeron {reporte.filas_leidas} filas y todas quedaron en orden.
              </p>
            ) : (
              <div className="space-y-1.5">
                {/* Cada error nombra la FILA del archivo: decir "hay 3 errores"
                    obliga a revisar 80 líneas a mano para encontrarlos. */}
                <p className="text-micro font-medium text-ink-secondary flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-accion-ink" />
                  Filas que no se cargaron — corrígelas y vuelve a subir el archivo
                </p>
                <div className="border border-line rounded-lg divide-y divide-line max-h-56 overflow-y-auto">
                  {reporte.errores.map(e => (
                    <div key={e.fila} className="px-3 py-2">
                      <p className="text-meta text-ink">
                        <span className="font-mono text-ink-muted">Fila {e.fila}</span>
                        {e.nombre && <span className="ml-2">{e.nombre}</span>}
                      </p>
                      <p className="text-[11px] text-accion-ink mt-0.5">{e.motivo}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-ink-subtle">
                  Volver a subir el archivo corregido es seguro: los que ya entraron no se duplican.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-lg bg-surface-app border border-line px-3 py-2.5 space-y-2">
              <p className="text-meta text-ink-secondary">
                El archivo necesita las columnas <strong>RUT</strong> y <strong>Nombre completo</strong>.
                El <strong>Cargo</strong> es opcional.
              </p>
              <button
                onClick={descargarPlantilla}
                disabled={descargando}
                className="inline-flex items-center gap-1.5 text-micro font-medium text-ink hover:underline disabled:text-ink-subtle"
              >
                <Download size={13} />
                {descargando ? "Descargando..." : "Descargar plantilla"}
              </button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xlsm,.txt"
              className="hidden"
              onChange={e => { setArchivo(e.target.files?.[0] ?? null); setError(null) }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full border border-dashed border-line-strong rounded-lg py-6 flex flex-col items-center gap-2 hover:bg-surface-app transition-colors"
            >
              <FileSpreadsheet size={22} className="text-ink-subtle" />
              <span className="text-body text-ink-secondary">
                {archivo ? archivo.name : "Elegir archivo .csv o .xlsx"}
              </span>
              {!archivo && <span className="text-[10px] text-ink-subtle">o arrastra la planilla aquí</span>}
            </button>

            {error && <p className="text-body text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
          </div>
        )}

        <div className="px-6 py-4 border-t border-line-subtle">
          {reporte ? (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg text-strong font-medium bg-surface-inverse text-white hover:bg-surface-inverse-hover transition-all"
            >
              Listo
            </button>
          ) : (
            <button
              onClick={subir}
              disabled={!archivo || subiendo}
              className={cn(
                "w-full py-2.5 rounded-lg text-strong font-medium transition-all inline-flex items-center justify-center gap-2",
                !archivo || subiendo
                  ? "bg-line text-ink-subtle cursor-not-allowed"
                  : "bg-surface-inverse text-white hover:bg-surface-inverse-hover",
              )}
            >
              <Upload size={14} />
              {subiendo ? "Cargando..." : "Cargar nómina"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
