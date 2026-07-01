"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { api } from "@/shared/lib/api"
import type { Trabajador } from "@/shared/types"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AgregarTrabajadorDialog({ open, onClose, onSuccess }: Props) {
  const [rut, setRut] = useState("")
  const [nombre, setNombre] = useState("")
  const [cargo, setCargo] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post<Trabajador>("/api/v1/trabajadores/", {
        rut,
        nombre_completo: nombre,
        cargo: cargo || null,
      })
      onSuccess()
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al agregar trabajador")
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (!loading) {
      setRut("")
      setNombre("")
      setCargo("")
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar trabajador</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rut">RUT</Label>
            <Input
              id="rut"
              placeholder="12.345.678-9"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input
              id="nombre"
              placeholder="Juan Pérez González"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo (opcional)</Label>
            <Input
              id="cargo"
              placeholder="Operador de maquinaria"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
