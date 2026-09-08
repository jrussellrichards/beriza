"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { MUTUALIDADES } from "@/entities/contratista/mutualidades"

/** Los datos de fiscalización de la empresa. Espejo de EmpresaContratistaResponse. */
export interface ValoresFicha {
  razon_social: string
  giro: string | null
  mutualidad: string | null
  direccion: string | null
  telefono_emergencia: string | null
  representante_legal_nombre: string | null
  representante_legal_rut: string | null
  representante_legal_telefono: string | null
}

const norm = (v: string | null | undefined) => (v ?? "").trim()

/**
 * Completa o corrige la ficha de fiscalización de una empresa contratista.
 *
 * Reutilizable a propósito: el mandante la edita desde el panel del contratista
 * y la propia empresa desde su portal. Lo único que cambia entre los dos es a
 * qué endpoint van los cambios, así que eso lo decide el llamador en `onGuardar`
 * y el diálogo solo sabe de campos.
 *
 * Manda SOLO lo que cambió y la cadena vacía SÍ viaja: es la forma de limpiar un
 * dato mal cargado, y el backend la interpreta como "borrar". La razón social es
 * la excepción —no puede quedar vacía—, así que ahí el botón se bloquea.
 */
export function FichaEmpresaDialog({ titulo = "Datos de la empresa", valores, onGuardar, onClose }: {
  titulo?: string
  valores: ValoresFicha
  onGuardar: (cambios: Partial<ValoresFicha>) => Promise<void>
  onClose: () => void
}) {
  const [razonSocial, setRazonSocial] = useState(valores.razon_social ?? "")
  const [mutualidad, setMutualidad] = useState(valores.mutualidad ?? "")
  const [giro, setGiro] = useState(valores.giro ?? "")
  const [direccion, setDireccion] = useState(valores.direccion ?? "")
  const [telEmergencia, setTelEmergencia] = useState(valores.telefono_emergencia ?? "")
  const [repNombre, setRepNombre] = useState(valores.representante_legal_nombre ?? "")
  const [repRut, setRepRut] = useState(valores.representante_legal_rut ?? "")
  const [repTelefono, setRepTelefono] = useState(valores.representante_legal_telefono ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Solo los campos que efectivamente cambiaron respecto de lo que llegó. Null y
  // "" se comparan como iguales para no mandar un "borrado" espurio de un campo
  // que ya venía vacío.
  function cambios(): Partial<ValoresFicha> {
    const c: Partial<ValoresFicha> = {}
    if (razonSocial.trim() !== norm(valores.razon_social)) c.razon_social = razonSocial.trim()
    if (mutualidad !== norm(valores.mutualidad)) c.mutualidad = mutualidad
    if (giro.trim() !== norm(valores.giro)) c.giro = giro.trim()
    if (direccion.trim() !== norm(valores.direccion)) c.direccion = direccion.trim()
    if (telEmergencia.trim() !== norm(valores.telefono_emergencia)) c.telefono_emergencia = telEmergencia.trim()
    if (repNombre.trim() !== norm(valores.representante_legal_nombre)) c.representante_legal_nombre = repNombre.trim()
    if (repRut.trim() !== norm(valores.representante_legal_rut)) c.representante_legal_rut = repRut.trim()
    if (repTelefono.trim() !== norm(valores.representante_legal_telefono)) c.representante_legal_telefono = repTelefono.trim()
    return c
  }

  const pendientes = cambios()
  const hayCambios = Object.keys(pendientes).length > 0
  const razonVacia = razonSocial.trim() === ""

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hayCambios) return
    setLoading(true)
    setError(null)
    try {
      await onGuardar(pendientes)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los datos")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => !loading && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fe-razon">Razón social</Label>
            <Input
              id="fe-razon"
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              required
            />
            {razonVacia && (
              <p className="text-[11px] text-bloqueo-ink">La empresa necesita una razón social.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fe-mutualidad">Mutualidad</Label>
            <select
              id="fe-mutualidad"
              value={mutualidad}
              onChange={(e) => setMutualidad(e.target.value)}
              className="w-full px-3 py-2 text-body border border-line rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <option value="">Sin registrar</option>
              {MUTUALIDADES.map((m) => (
                <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
              ))}
            </select>
            <p className="text-[10px] text-ink-subtle">
              Organismo de la Ley 16.744 donde se denuncia un accidente.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fe-giro">Giro</Label>
            <Input id="fe-giro" placeholder="Construcción de obras civiles" value={giro} onChange={(e) => setGiro(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fe-direccion">Dirección de la empresa</Label>
            <Input id="fe-direccion" placeholder="Av. Apoquindo 4700, Las Condes" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fe-tel-emergencia">Teléfono de emergencia</Label>
            <Input id="fe-tel-emergencia" placeholder="+56 9 1234 5678" value={telEmergencia} onChange={(e) => setTelEmergencia(e.target.value)} />
            <p className="text-[10px] text-ink-subtle">A quién llamar por algo en faena fuera de horario.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fe-rep-nombre">Representante legal</Label>
            <Input id="fe-rep-nombre" placeholder="María Soto Rivas" value={repNombre} onChange={(e) => setRepNombre(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input id="fe-rep-rut" placeholder="RUT — 12.345.678-5" value={repRut} onChange={(e) => setRepRut(e.target.value)} />
              <Input id="fe-rep-telefono" placeholder="Teléfono" value={repTelefono} onChange={(e) => setRepTelefono(e.target.value)} />
            </div>
            <p className="text-[10px] text-ink-subtle">
              El RUT permite contrastar contra el certificado de vigencia de poderes.
            </p>
          </div>

          {error && <p className="text-body text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !hayCambios || razonVacia}>
              {loading ? "Guardando..." : hayCambios ? "Guardar" : "Sin cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
