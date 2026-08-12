"use client"

import { useEffect, useState } from "react"
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
import { getSession } from "@/shared/lib/auth"
import type { Perfil } from "@/entities/servicio/types"

interface ContratistaItem {
  contratista_id: string
  razon_social: string
  rut: string
}

interface CentroTrabajo {
  id: string
  nombre: string
  direccion: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CrearServicioDialog({ open, onClose, onSuccess }: Props) {
  const [contratistas, setContratistas] = useState<ContratistaItem[]>([])
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [centros, setCentros] = useState<CentroTrabajo[]>([])
  const [centroId, setCentroId] = useState("")
  const [contratistaId, setContratistaId] = useState("")
  const [perfilId, setPerfilId] = useState("")
  const perfilVacio = perfiles.find(p => p.id === perfilId)?.requisitos_exigidos === 0
  const [nombre, setNombre] = useState("")
  const [codigoRef, setCodigoRef] = useState("")
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaTermino, setFechaTermino] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const s = getSession()
    if (!s?.mandante_id) return
    api.get<ContratistaItem[]>(`/api/v1/mandantes/${s.mandante_id}/contratistas`)
      .then(setContratistas).catch(() => setContratistas([]))
    api.get<Perfil[]>(`/api/v1/mandantes/${s.mandante_id}/perfiles`)
      .then(setPerfiles).catch(() => setPerfiles([]))
    // Solo los centros ACTIVOS: uno cerrado no admite servicios nuevos y
    // ofrecerlo sería un 400 garantizado al enviar.
    api.get<CentroTrabajo[]>("/api/v1/centros-trabajo/")
      .then(setCentros).catch(() => setCentros([]))
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post("/api/v1/servicios/", {
        contratista_id: contratistaId,
        perfil_requisitos_id: perfilId,
        centro_trabajo_id: centroId,
        nombre,
        codigo_referencia: codigoRef || null,
        fecha_inicio: fechaInicio,
        fecha_termino: fechaTermino || null,
      })
      onSuccess()
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear servicio")
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (!loading) {
      setContratistaId(""); setPerfilId(""); setNombre(""); setCentroId("")
      setCodigoRef(""); setFechaInicio(""); setFechaTermino("")
      setError(null)
      onClose()
    }
  }

  const selectClass =
    "w-full px-3 py-2 text-body border border-line rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo servicio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="centro">Centro de trabajo</Label>
            <select
              id="centro"
              className={selectClass}
              value={centroId}
              onChange={(e) => setCentroId(e.target.value)}
              required
            >
              <option value="" disabled>¿Dónde se ejecuta?</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}{c.direccion ? ` — ${c.direccion}` : ""}
                </option>
              ))}
            </select>
            {centros.length === 0 && (
              <p className="text-[10px] text-accion-ink">
                Todavía no tienes centros de trabajo. Créalos en la sección Centros
                antes de dar de alta un servicio.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contratista">Contratista</Label>
            <select
              id="contratista"
              className={selectClass}
              value={contratistaId}
              onChange={(e) => setContratistaId(e.target.value)}
              required
            >
              <option value="" disabled>Selecciona una empresa...</option>
              {contratistas.map((c) => (
                <option key={c.contratista_id} value={c.contratista_id}>
                  {c.razon_social} — {c.rut}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="perfil">Perfil de requisitos</Label>
            <select
              id="perfil"
              className={selectClass}
              value={perfilId}
              onChange={(e) => setPerfilId(e.target.value)}
              required
            >
              <option value="" disabled>Selecciona un perfil...</option>
              {perfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {p.requisitos_exigidos === 0
                    ? "no exige nada"
                    : `${p.requisitos_exigidos} documento${p.requisitos_exigidos === 1 ? "" : "s"}`}
                </option>
              ))}
            </select>
            {/* Un perfil vacío deja al contratista figurando en regla sin haber
                entregado un documento. Se avisa ACÁ, que es donde se toma la
                decisión, y no sólo en la pantalla de perfiles. */}
            {perfilVacio && (
              <p className="text-meta text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line rounded-md px-3 py-2">
                Ese perfil no exige ningún documento: el contratista de esta faena va a
                figurar en regla sin entregar nada. Puedes crear el servicio igual y
                configurarlo después en Perfiles.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del servicio</Label>
            <Input
              id="nombre"
              placeholder="Movimiento de tierras — Fase 2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="codigoRef">N° de contrato / OC (opcional)</Label>
            <Input
              id="codigoRef"
              placeholder="CTR-2026-0142"
              value={codigoRef}
              onChange={(e) => setCodigoRef(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fechaInicio">Fecha inicio</Label>
              <Input
                id="fechaInicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaTermino">Fecha término (opcional)</Label>
              <Input
                id="fechaTermino"
                type="date"
                value={fechaTermino}
                onChange={(e) => setFechaTermino(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="text-body text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear servicio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
