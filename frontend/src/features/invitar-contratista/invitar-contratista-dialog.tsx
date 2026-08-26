"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { api } from "@/shared/lib/api"
import { MUTUALIDADES } from "@/entities/contratista/mutualidades"

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
  // Datos para fiscalizacion. Van plegados y opcionales: el mandante muchas
  // veces invita con lo que tiene del contrato y el resto lo consigue despues.
  // Ponerlos delante y obligatorios convertiria la invitacion en un tramite.
  const [verFiscalizacion, setVerFiscalizacion] = useState(false)
  const [mutualidad, setMutualidad] = useState("")
  const [direccion, setDireccion] = useState("")
  const [telefonoEmergencia, setTelefonoEmergencia] = useState("")
  const [repNombre, setRepNombre] = useState("")
  const [repRut, setRepRut] = useState("")
  const [repTelefono, setRepTelefono] = useState("")
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
        {
          email, razon_social: razonSocial, rut,
          // Solo viaja lo que se escribio: mandar cadenas vacias guardaria
          // campos en blanco que despues parecen "cargado y vacio" en vez de
          // "todavia no se sabe".
          ...(mutualidad && { mutualidad }),
          ...(direccion.trim() && { direccion: direccion.trim() }),
          ...(telefonoEmergencia.trim() && { telefono_emergencia: telefonoEmergencia.trim() }),
          ...(repNombre.trim() && { representante_legal_nombre: repNombre.trim() }),
          ...(repRut.trim() && { representante_legal_rut: repRut.trim() }),
          ...(repTelefono.trim() && { representante_legal_telefono: repTelefono.trim() }),
        },
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
          {/* Datos para fiscalizacion, plegados. Lo de arriba es lo que hace
              falta para invitar; esto es lo que hace falta cuando llega la
              Direccion del Trabajo, y casi nunca se tiene en el mismo momento. */}
          <div className="border-t border-line-subtle pt-3">
            <button
              type="button"
              onClick={() => setVerFiscalizacion(v => !v)}
              aria-expanded={verFiscalizacion}
              className="flex items-center gap-1.5 text-micro font-medium text-ink-muted hover:text-ink transition-colors"
            >
              <ChevronRight size={13} className={verFiscalizacion ? "rotate-90 transition-transform" : "transition-transform"} />
              Datos para fiscalización
              <span className="text-ink-subtle font-normal">— opcional, se pueden completar después</span>
            </button>

            {verFiscalizacion && (
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="mutualidad">Mutualidad</Label>
                  <select
                    id="mutualidad"
                    value={mutualidad}
                    onChange={(e) => setMutualidad(e.target.value)}
                    className="w-full px-3 py-2 text-body border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    <option value="">Sin definir</option>
                    {MUTUALIDADES.map(m => (
                      <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-ink-subtle">
                    Define a quién se denuncia un accidente en faena.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección de la empresa</Label>
                  <Input
                    id="direccion"
                    placeholder="Av. Pedro Aguirre Cerda 5000, Antofagasta"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tel-emergencia">Teléfono de emergencia</Label>
                  <Input
                    id="tel-emergencia"
                    placeholder="+56 9 1234 5678"
                    value={telefonoEmergencia}
                    onChange={(e) => setTelefonoEmergencia(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rep-nombre">Representante legal</Label>
                  <Input
                    id="rep-nombre"
                    placeholder="María Soto Rivas"
                    value={repNombre}
                    onChange={(e) => setRepNombre(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      id="rep-rut"
                      placeholder="RUT — 12.345.678-5"
                      value={repRut}
                      onChange={(e) => setRepRut(e.target.value)}
                    />
                    <Input
                      id="rep-telefono"
                      placeholder="Teléfono"
                      value={repTelefono}
                      onChange={(e) => setRepTelefono(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-ink-subtle">
                    El RUT permite contrastar contra el certificado de vigencia de poderes.
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-body text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
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
