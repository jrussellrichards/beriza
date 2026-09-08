"use client"

import { useEffect, useState } from "react"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { api } from "@/shared/lib/api"

/** Espejo de TrabajadorResponse — la ficha completa, que el listado no trae. */
interface TrabajadorDetalle {
  id: string
  rut: string
  nombre_completo: string
  cargo: string | null
  fecha_nacimiento: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  contacto_emergencia_nombre: string | null
  contacto_emergencia_telefono: string | null
}

const norm = (v: string | null | undefined) => (v ?? "").trim()

/**
 * Edita la ficha de un trabajador de la propia empresa.
 *
 * Existe porque los datos personales son opcionales al darlo de alta y quien
 * entra por nómina masiva llega solo con RUT, nombre y cargo: sin esto, ese
 * trabajador se quedaba para siempre sin contacto de emergencia y sin forma de
 * agregárselo.
 *
 * Carga la ficha al abrir en vez de recibirla por props: el listado de
 * trabajadores no trae los datos personales, y editarlos sin verlos los
 * borraría. El RUT se muestra pero no se edita —es la identidad de la persona
 * dentro de la empresa; si está mal, se desactiva y se crea la correcta—.
 */
export function EditarTrabajadorDialog({ trabajadorId, onClose, onGuardado }: {
  trabajadorId: string
  onClose: () => void
  onGuardado: () => void
}) {
  const [detalle, setDetalle] = useState<TrabajadorDetalle | null>(null)
  const [nombre, setNombre] = useState("")
  const [cargo, setCargo] = useState("")
  const [fechaNacimiento, setFechaNacimiento] = useState("")
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [direccion, setDireccion] = useState("")
  const [emergNombre, setEmergNombre] = useState("")
  const [emergTelefono, setEmergTelefono] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    api.get<TrabajadorDetalle>(`/api/v1/trabajadores/${trabajadorId}`)
      .then((d) => {
        if (!vigente) return
        setDetalle(d)
        setNombre(d.nombre_completo)
        setCargo(d.cargo ?? "")
        setFechaNacimiento(d.fecha_nacimiento ?? "")
        setEmail(d.email ?? "")
        setTelefono(d.telefono ?? "")
        setDireccion(d.direccion ?? "")
        setEmergNombre(d.contacto_emergencia_nombre ?? "")
        setEmergTelefono(d.contacto_emergencia_telefono ?? "")
      })
      .catch((e) => vigente && setError(e instanceof Error ? e.message : "No se pudo cargar la ficha"))
    return () => { vigente = false }
  }, [trabajadorId])

  // Solo lo que cambió. La cadena vacía viaja: es la forma de limpiar un dato mal
  // cargado. El nombre es la excepción —no puede quedar vacío—.
  function cambios(): Record<string, string> {
    if (!detalle) return {}
    const c: Record<string, string> = {}
    if (nombre.trim() !== norm(detalle.nombre_completo)) c.nombre_completo = nombre.trim()
    if (cargo.trim() !== norm(detalle.cargo)) c.cargo = cargo.trim()
    if (fechaNacimiento !== norm(detalle.fecha_nacimiento)) c.fecha_nacimiento = fechaNacimiento
    if (email.trim() !== norm(detalle.email)) c.email = email.trim()
    if (telefono.trim() !== norm(detalle.telefono)) c.telefono = telefono.trim()
    if (direccion.trim() !== norm(detalle.direccion)) c.direccion = direccion.trim()
    if (emergNombre.trim() !== norm(detalle.contacto_emergencia_nombre)) c.contacto_emergencia_nombre = emergNombre.trim()
    if (emergTelefono.trim() !== norm(detalle.contacto_emergencia_telefono)) c.contacto_emergencia_telefono = emergTelefono.trim()
    return c
  }

  const pendientes = cambios()
  const hayCambios = Object.keys(pendientes).length > 0
  const nombreVacio = nombre.trim() === ""

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hayCambios) return
    setLoading(true)
    setError(null)
    try {
      await api.patch(`/api/v1/trabajadores/${trabajadorId}`, pendientes)
      onGuardado()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los cambios")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => !loading && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar ficha del trabajador</DialogTitle>
        </DialogHeader>

        {!detalle && !error && (
          <p className="text-meta text-ink-subtle">Cargando ficha...</p>
        )}

        {detalle && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>RUT</Label>
              <Input value={detalle.rut} disabled className="bg-surface-app text-ink-subtle" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-nombre">Nombre completo</Label>
              <Input id="et-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              {nombreVacio && <p className="text-[11px] text-bloqueo-ink">El trabajador necesita un nombre.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-cargo">Cargo</Label>
              <Input id="et-cargo" placeholder="Operador de maquinaria" value={cargo} onChange={(e) => setCargo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-fecha">Fecha de nacimiento</Label>
              <Input id="et-fecha" type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
              <p className="text-[10px] text-ink-subtle">Necesaria para comprobar restricciones de edad en faena.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="et-email">Correo</Label>
                <Input id="et-email" type="email" placeholder="persona@correo.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="et-tel">Teléfono</Label>
                <Input id="et-tel" placeholder="+56 9 1234 5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-dir">Dirección</Label>
              <Input id="et-dir" placeholder="Pasaje Los Aromos 45, Calama" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-emerg-nombre">En caso de emergencia, llamar a</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input id="et-emerg-nombre" placeholder="Nombre" value={emergNombre} onChange={(e) => setEmergNombre(e.target.value)} />
                <Input id="et-emerg-tel" placeholder="Teléfono" value={emergTelefono} onChange={(e) => setEmergTelefono(e.target.value)} />
              </div>
            </div>

            {error && <p className="text-body text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading || !hayCambios || nombreVacio}>
                {loading ? "Guardando..." : hayCambios ? "Guardar" : "Sin cambios"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {error && !detalle && (
          <p className="text-body text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
