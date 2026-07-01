"use client"

import { useState } from "react"
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
import type { SubidaDocumentoResponse } from "@/shared/types"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  requisitoId: string
  requisitoNombre: string
  entidadTipo: "empresa" | "trabajador"
  entidadId: string
  mandanteId: string
}

export function SubirDocumentoDialog({
  open,
  onClose,
  onSuccess,
  requisitoId,
  requisitoNombre,
  entidadTipo,
  entidadId,
  mandanteId,
}: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)

    try {
      const form = new FormData()
      form.append("archivo", file)
      form.append("requisito_id", requisitoId)
      form.append("entidad_tipo", entidadTipo)
      form.append("entidad_id", entidadId)
      form.append("mandante_id", mandanteId)

      await api.upload<SubidaDocumentoResponse>("/api/v1/documentos/", form)
      onSuccess()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir archivo")
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (!loading) {
      setFile(null)
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subir documento</DialogTitle>
          <DialogDescription>{requisitoNombre}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="archivo">Archivo PDF</Label>
            <Input
              id="archivo"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            <p className="text-xs text-slate-500">Máximo 20 MB. Solo archivos PDF.</p>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!file || loading}>
              {loading ? "Subiendo..." : "Subir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
