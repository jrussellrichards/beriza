"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
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
  // Datos personales, plegados. Lo de arriba identifica a la persona; esto es
  // ficha, y quien carga una nomina de 40 personas casi nunca lo tiene a mano.
  const [verFicha, setVerFicha] = useState(false)
  const [fechaNacimiento, setFechaNacimiento] = useState("")
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [direccion, setDireccion] = useState("")
  const [emergNombre, setEmergNombre] = useState("")
  const [emergTelefono, setEmergTelefono] = useState("")
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
        // Solo viaja lo que se escribio. Un campo en blanco guardado se lee
        // despues como "se pregunto y no hay", que no es lo mismo que "todavia
        // no se pregunto".
        ...(fechaNacimiento && { fecha_nacimiento: fechaNacimiento }),
        ...(email.trim() && { email: email.trim() }),
        ...(telefono.trim() && { telefono: telefono.trim() }),
        ...(direccion.trim() && { direccion: direccion.trim() }),
        ...(emergNombre.trim() && { contacto_emergencia_nombre: emergNombre.trim() }),
        ...(emergTelefono.trim() && { contacto_emergencia_telefono: emergTelefono.trim() }),
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
      setVerFicha(false)
      setFechaNacimiento("")
      setEmail("")
      setTelefono("")
      setDireccion("")
      setEmergNombre("")
      setEmergTelefono("")
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
          {/* Ficha de la persona, plegada. Se puede completar despues con
              PATCH: quien entra por nomina masiva llega solo con RUT, nombre y
              cargo, y aun asi tiene que poder tener contacto de emergencia. */}
          <div className="border-t border-line-subtle pt-3">
            <button
              type="button"
              onClick={() => setVerFicha(v => !v)}
              aria-expanded={verFicha}
              className="flex items-center gap-1.5 text-micro font-medium text-ink-muted hover:text-ink transition-colors"
            >
              <ChevronRight size={13} className={verFicha ? "rotate-90 transition-transform" : "transition-transform"} />
              Ficha de la persona
              <span className="text-ink-subtle font-normal">— opcional, se puede completar después</span>
            </button>

            {verFicha && (
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha-nac">Fecha de nacimiento</Label>
                  <Input
                    id="fecha-nac"
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                  />
                  <p className="text-[10px] text-ink-subtle">
                    Necesaria para comprobar restricciones de edad en faena.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="email-trab">Correo</Label>
                    <Input
                      id="email-trab"
                      type="email"
                      placeholder="persona@correo.cl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tel-trab">Teléfono</Label>
                    <Input
                      id="tel-trab"
                      placeholder="+56 9 1234 5678"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dir-trab">Dirección</Label>
                  <Input
                    id="dir-trab"
                    placeholder="Pasaje Los Aromos 45, Calama"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emerg-nombre">En caso de emergencia, llamar a</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      id="emerg-nombre"
                      placeholder="Nombre"
                      value={emergNombre}
                      onChange={(e) => setEmergNombre(e.target.value)}
                    />
                    <Input
                      id="emerg-telefono"
                      placeholder="Teléfono"
                      value={emergTelefono}
                      onChange={(e) => setEmergTelefono(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-body text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>
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
