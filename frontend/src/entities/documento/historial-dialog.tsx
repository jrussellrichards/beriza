"use client"

import { useEffect, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"

interface Archivo {
  id: string
  orden: number
  nombre_original: string
  tamaño_bytes: number
}

interface Version {
  id: string
  numero_version: number
  estado: number
  mensaje_brecha: string | null
  fecha_vigencia_hasta: string | null
  aprobado_por_excepcion: boolean
  created_at: string
  archivos: Archivo[]
}

interface Evento {
  tipo_evento: string
  estado_anterior: number | null
  estado_nuevo: number | null
  detalle: Record<string, unknown> | null
  created_at: string
}

interface Historial {
  documento_id: string
  versiones: Version[]
  eventos: Evento[]
}

const ESTADO_LABEL: Record<string, { label: string; cls: string }> = {
  "1": { label: "En revisión", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  "2": { label: "En análisis", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  "3": { label: "Observado", cls: "bg-red-50 text-red-700 border-red-200" },
  "4": { label: "Aprobado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
}

const EVENTO_LABEL: Record<string, string> = {
  SUBIDA: "Entrega subida",
  CAMBIO_ESTADO: "Cambio de estado",
  REVISION_MANUAL: "Revisión del mandante",
  EXCEPCION_APROBADA: "Aprobación por excepción",
  ELIMINACION: "Eliminación",
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export function HistorialDialog({ documentoId, titulo, onClose }: {
  documentoId: string
  titulo: string
  onClose: () => void
}) {
  const [historial, setHistorial] = useState<Historial | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [descargando, setDescargando] = useState<string | null>(null)

  async function descargar(archivoId: string) {
    setDescargando(archivoId)
    try {
      const r = await api.get<{ url: string }>(
        `/api/v1/documentos/${documentoId}/archivos/${archivoId}/url-descarga`
      )
      window.open(r.url, "_blank")
    } catch {
      // el botón simplemente no abre nada si falla
    } finally {
      setDescargando(null)
    }
  }

  useEffect(() => {
    api.get<Historial>(`/api/v1/documentos/${documentoId}/historial`)
      .then(setHistorial)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar historial"))
  }, [documentoId])

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial del expediente</DialogTitle>
          <DialogDescription>{titulo}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
        {!historial && !error && (
          <div className="flex justify-center py-8 text-slate-400"><Loader2 size={18} className="animate-spin" /></div>
        )}

        {historial && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Versiones ({historial.versiones.length})
              </p>
              <div className="space-y-2">
                {[...historial.versiones].reverse().map((v) => {
                  const e = ESTADO_LABEL[String(v.estado)] ?? { label: `Estado ${v.estado}`, cls: "bg-slate-50 text-slate-600 border-slate-200" }
                  return (
                    <div key={v.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-800">
                          Versión {v.numero_version}
                          {v.aprobado_por_excepcion && (
                            <span className="ml-2 text-[10px] font-medium text-purple-600 border border-purple-200 bg-purple-50 rounded px-1.5 py-0.5">
                              Excepción
                            </span>
                          )}
                        </p>
                        <span className={cn("text-[10px] font-medium border rounded-full px-2 py-0.5", e.cls)}>
                          {e.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {fecha(v.created_at)}
                        {v.fecha_vigencia_hasta ? ` · vigente hasta ${v.fecha_vigencia_hasta}` : ""}
                      </p>
                      {v.mensaje_brecha && (
                        <p className="text-[11px] text-red-600 mt-1">{v.mensaje_brecha}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {v.archivos.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => descargar(a.id)}
                            disabled={descargando === a.id}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 rounded px-1.5 py-0.5 transition-colors disabled:opacity-50"
                          >
                            {descargando === a.id ? <Loader2 size={9} className="animate-spin" /> : <Download size={9} />}
                            {a.nombre_original}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Bitácora ({historial.eventos.length})
              </p>
              <div className="space-y-0">
                {[...historial.eventos].reverse().map((ev, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-1.5 border-l-2 border-slate-100 pl-3 ml-1">
                    <div className="flex-1">
                      <p className="text-xs text-slate-700">
                        {EVENTO_LABEL[ev.tipo_evento] ?? ev.tipo_evento}
                        {ev.estado_anterior !== null && ev.estado_nuevo !== null && (
                          <span className="text-slate-400">
                            {" "}· {ESTADO_LABEL[String(ev.estado_anterior)]?.label ?? ev.estado_anterior} → {ESTADO_LABEL[String(ev.estado_nuevo)]?.label ?? ev.estado_nuevo}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400">{fecha(ev.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
