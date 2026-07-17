"use client"

import { useEffect, useState } from "react"
import { FileText, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Label } from "@/shared/ui/label"
import { Input } from "@/shared/ui/input"
import { api } from "@/shared/lib/api"
import type { Servicio } from "@/entities/servicio/types"

export interface RequisitoSubida {
  id: string
  nombre: string
  codigo: string
  alcance: "ENTIDAD" | "SERVICIO"
  max_archivos: number
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  requisito: RequisitoSubida
  mandanteId: string
  /** Exactamente uno de los dos, según el entidad_tipo del requisito */
  empresaId?: string
  trabajadorId?: string
  trabajadorNombre?: string
  /** Para requisitos de alcance SERVICIO cuando el servicio ya está determinado */
  servicioFijo?: { id: string; nombre: string }
}

export function SubirDocumentoDialog({
  open, onClose, onSuccess, requisito, mandanteId, empresaId, trabajadorId, trabajadorNombre, servicioFijo,
}: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [servicioId, setServicioId] = useState(servicioFijo?.id ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requiereServicio = requisito.alcance === "SERVICIO"

  useEffect(() => {
    if (!open || !requiereServicio || servicioFijo) return
    api.get<Servicio[]>("/api/v1/servicios/")
      .then((s) => {
        const activos = s.filter((x) => x.estado === "ACTIVO")
        setServicios(activos)
        if (activos.length === 1) setServicioId(activos[0].id)
      })
      .catch(() => setServicios([]))
  }, [open, requiereServicio, servicioFijo])

  function agregarArchivos(nuevos: FileList | null) {
    if (!nuevos) return
    setFiles((prev) => [...prev, ...Array.from(nuevos)].slice(0, requisito.max_archivos))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("requisito_id", requisito.id)
      form.append("mandante_id", mandanteId)
      if (trabajadorId) form.append("trabajador_id", trabajadorId)
      else if (empresaId) form.append("empresa_id", empresaId)
      if (requiereServicio && servicioId) form.append("servicio_id", servicioId)
      files.forEach((f) => form.append("archivos", f))

      await api.upload("/api/v1/documentos/", form)
      onSuccess()
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir archivo")
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (!loading) {
      setFiles([])
      setServicioId("")
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subir documento</DialogTitle>
          <DialogDescription>
            {requisito.nombre}
            {trabajadorNombre ? ` — ${trabajadorNombre}` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {requiereServicio && servicioFijo && (
            <p className="text-xs text-slate-600 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
              Este documento acredita el servicio <strong>{servicioFijo.nombre}</strong>.
            </p>
          )}
          {requiereServicio && !servicioFijo && (
            <div className="space-y-2">
              <Label htmlFor="servicio">Servicio / faena</Label>
              <select
                id="servicio"
                value={servicioId}
                onChange={(e) => setServicioId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="" disabled>Selecciona el servicio...</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}{s.codigo_referencia ? ` (${s.codigo_referencia})` : ""}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Este documento se acredita por cada servicio contratado.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="archivos">
              Archivo{requisito.max_archivos > 1 ? `s (hasta ${requisito.max_archivos})` : " PDF"}
            </Label>
            <Input
              id="archivos"
              type="file"
              accept="application/pdf"
              multiple={requisito.max_archivos > 1}
              onChange={(e) => { agregarArchivos(e.target.files); e.target.value = "" }}
            />
            <p className="text-xs text-slate-500">Máximo 20 MB por archivo. Solo PDF.</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                  <FileText size={13} className="text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-700 truncate flex-1">{f.name}</span>
                  <span className="text-[10px] text-slate-400">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="text-slate-300 hover:text-red-500"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={files.length === 0 || loading || (requiereServicio && !servicioId)}>
              {loading ? "Subiendo..." : `Subir ${files.length > 1 ? `${files.length} archivos` : ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
