"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Download, FileText, Inbox, RefreshCw, XCircle } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Textarea } from "@/shared/ui/textarea"

interface ArchivoPendiente {
  id: string
  orden: number
  nombre_original: string
  mime_type: string
  tamaño_bytes: number
}

interface Pendiente {
  documento_id: string
  requisito_codigo: string
  requisito_nombre: string
  pilar_nombre: string
  contratista_razon_social: string
  trabajador_nombre: string | null
  servicio_nombre: string | null
  numero_version: number
  subido_en: string
  archivos: ArchivoPendiente[]
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

// ── Dialog de revisión ────────────────────────────────────────────────────────

function RevisarDialog({ pendiente, accion, onClose, onDone }: {
  pendiente: Pendiente
  accion: "aprobar" | "observar"
  onClose: () => void
  onDone: () => void
}) {
  const [fechaVigencia, setFechaVigencia] = useState("")
  const [motivo, setMotivo] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post(`/api/v1/documentos/${pendiente.documento_id}/revisar`, {
        aprobar: accion === "aprobar",
        mensaje_brecha: accion === "observar" ? motivo : null,
        fecha_vigencia_hasta: accion === "aprobar" && fechaVigencia ? fechaVigencia : null,
      })
      onDone()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al revisar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => !loading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{accion === "aprobar" ? "Aprobar documento" : "Observar documento"}</DialogTitle>
          <DialogDescription>
            {pendiente.requisito_nombre} — {pendiente.contratista_razon_social}
            {pendiente.trabajador_nombre ? ` (${pendiente.trabajador_nombre})` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {accion === "aprobar" ? (
            <div className="space-y-2">
              <Label htmlFor="vigencia">Vigente hasta (opcional)</Label>
              <Input
                id="vigencia"
                type="date"
                value={fechaVigencia}
                onChange={(e) => setFechaVigencia(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Fecha de vencimiento del documento, si aplica (ej. F30 vence a 30 días).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo de la observación</Label>
              <Textarea
                id="motivo"
                placeholder="Ej: El certificado está vencido, la fecha de emisión supera los 30 días..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
                rows={3}
              />
              <p className="text-xs text-slate-500">
                El contratista verá este mensaje exacto para corregir su entrega.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || (accion === "observar" && !motivo.trim())}
              className={accion === "aprobar" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
            >
              {loading ? "Guardando..." : accion === "aprobar" ? "Aprobar" : "Observar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function RevisionPage() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogo, setDialogo] = useState<{ pendiente: Pendiente; accion: "aprobar" | "observar" } | null>(null)

  const cargar = useCallback(() => {
    setLoading(true)
    api.get<Pendiente[]>("/api/v1/documentos/pendientes-revision")
      .then(setPendientes)
      .catch(() => setPendientes([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function descargar(p: Pendiente, archivo: ArchivoPendiente) {
    try {
      const r = await api.get<{ url: string }>(
        `/api/v1/documentos/${p.documento_id}/archivos/${archivo.id}/url-descarga`
      )
      window.open(r.url, "_blank")
    } catch {
      // sin acción: el botón simplemente no navega si falla
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Revisión de documentos</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Entregas de contratistas pendientes de tu aprobación
            </p>
          </div>
          <button
            onClick={cargar}
            className="flex items-center gap-2 text-sm text-slate-500 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={13} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            {pendientes.length} entrega{pendientes.length !== 1 ? "s" : ""} pendiente{pendientes.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading && pendientes.length === 0 && (
          <div className="py-14 text-center bg-white rounded-xl border border-slate-200">
            <p className="text-sm text-slate-400">Cargando entregas...</p>
          </div>
        )}

        {!loading && pendientes.length === 0 && (
          <div className="py-16 text-center bg-white rounded-xl border border-slate-200">
            <Inbox size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No hay entregas pendientes de revisión</p>
            <p className="text-xs text-slate-400 mt-1">Cuando un contratista suba un documento aparecerá aquí.</p>
          </div>
        )}

        <div className="space-y-3">
          {pendientes.map((p) => (
            <div key={p.documento_id} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{p.requisito_nombre}</p>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">
                        {p.requisito_codigo}
                      </span>
                      {p.numero_version > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-200">
                          v{p.numero_version}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.contratista_razon_social}
                      {p.trabajador_nombre && <> · Trabajador: <span className="font-medium">{p.trabajador_nombre}</span></>}
                      {p.servicio_nombre && <> · Servicio: {p.servicio_nombre}</>}
                      <span className="text-slate-400"> · {p.pilar_nombre} · {formatFecha(p.subido_en)}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {p.archivos.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => descargar(p, a)}
                          className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 px-2 py-1 rounded-md hover:bg-slate-50 transition-colors"
                        >
                          <Download size={11} />
                          {a.nombre_original}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setDialogo({ pendiente: p, accion: "observar" })}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    <XCircle size={13} /> Observar
                  </button>
                  <button
                    onClick={() => setDialogo({ pendiente: p, accion: "aprobar" })}
                    className="flex items-center gap-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-lg transition-colors"
                  >
                    <CheckCircle2 size={13} /> Aprobar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {dialogo && (
        <RevisarDialog
          pendiente={dialogo.pendiente}
          accion={dialogo.accion}
          onClose={() => setDialogo(null)}
          onDone={cargar}
        />
      )}
    </div>
  )
}
