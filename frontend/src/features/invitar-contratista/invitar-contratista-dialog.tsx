"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { api } from "@/shared/lib/api"

interface Props {
  mandanteId: string
  onClose: () => void
  onSuccess: () => void
}

interface InvitarContratistaResponse {
  mensaje: string
  link_activacion?: string
}

export function InvitarContratistaDialog({ mandanteId, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState("")
  const [razonSocial, setRazonSocial] = useState("")
  const [rut, setRut] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkActivacion, setLinkActivacion] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await api.post<InvitarContratistaResponse>(
        `/api/v1/mandantes/${mandanteId}/invitar-contratista`,
        { email, razon_social: razonSocial, rut },
      )
      onSuccess()
      if (data.link_activacion) {
        setLinkActivacion(data.link_activacion)
      } else {
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar la invitación")
    } finally {
      setLoading(false)
    }
  }

  if (linkActivacion) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contratista creado</DialogTitle>
            <DialogDescription>
              El email de invitación no pudo enviarse (dominio de correo aún no verificado).
              Comparte este link manualmente con {email} para que active su cuenta:
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={linkActivacion} onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(linkActivacion)}
            >
              Copiar
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" onClick={onClose}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={() => !loading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar contratista</DialogTitle>
          <DialogDescription>
            La empresa recibirá un email para activar su cuenta y comenzar a subir documentos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="razon">Razón social</Label>
            <Input
              id="razon"
              placeholder="Constructora Ejemplo SpA"
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rut">RUT de la empresa</Label>
            <Input
              id="rut"
              placeholder="76.123.456-7"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email del administrador</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@empresa.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar invitación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
