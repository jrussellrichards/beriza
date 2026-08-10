"use client"

import { useState } from "react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"

/**
 * Lo mínimo que el diálogo necesita saber de una cuenta. Lo cumplen tanto
 * UsuarioMandanteResponse como el listado de /usuarios/mi-equipo.
 */
export interface CuentaEditable {
  id: string
  nombre: string
  email: string
  cargo: string | null
  rol: string
  activo: boolean
  /** Invitación que nunca se activó: la salida es reenviar, no reactivar. */
  pendiente?: boolean
}

export interface OpcionRol {
  v: string
  label: string
  ayuda: string
}

/**
 * Alta, edición y baja de una cuenta. Compartido por los tres portales
 * —contratista, mandante y BERISA— a propósito: son las mismas reglas y tres
 * copias de una UI sensible a permisos es como se separan.
 *
 * Las acciones que el backend rechaza sobre uno mismo no se renderizan; quien
 * llama decide eso con `es_uno_mismo` y directamente no abre el diálogo.
 */
export function CuentaDialog({ cuenta, roles, onClose, onCambio, onAviso, onError }: {
  cuenta: CuentaEditable
  /** Roles que ESTE administrador puede otorgar. El backend lo revalida. */
  roles: OpcionRol[]
  onClose: () => void
  onCambio: () => void
  onAviso: (m: string) => void
  onError: (m: string) => void
}) {
  const [nombre, setNombre] = useState(cuenta.nombre)
  const [cargo, setCargo] = useState(cuenta.cargo ?? "")
  const [rol, setRol] = useState(cuenta.rol)
  const [cargando, setCargando] = useState(false)

  async function correr(fn: () => Promise<{ mensaje?: string }>) {
    setCargando(true)
    try {
      const r = await fn()
      if (r?.mensaje) onAviso(r.mensaje)
      onCambio()
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo completar la acción")
    } finally {
      setCargando(false)
    }
  }

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    correr(() => api.patch(`/api/v1/usuarios/${cuenta.id}`, { nombre, cargo: cargo || null, rol }))
  }

  function quitarAcceso() {
    const q = cuenta.pendiente
      ? `¿Cancelar la invitación a ${cuenta.nombre}? El correo quedará libre para reinvitar.`
      : `¿Quitarle el acceso a ${cuenta.nombre}? Su historial de aprobaciones se conserva.`
    if (!window.confirm(q)) return
    correr(() => api.delete(`/api/v1/usuarios/${cuenta.id}`))
  }

  return (
    <Dialog open onOpenChange={() => !cargando && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{cuenta.nombre}</DialogTitle></DialogHeader>

        <form onSubmit={guardar} className="space-y-4">
          {/* El correo no se edita: es la identidad con la que se activó la
              cuenta y con la que se resuelve el enlace de invitación. */}
          <p className="text-xs text-ink-muted font-mono">{cuenta.email}</p>

          {cuenta.pendiente && (
            <div className="flex items-center justify-between gap-3 text-xs bg-espera-soft border border-espera-line rounded-md px-3 py-2">
              <span className="text-espera-ink">Todavía no activa su cuenta.</span>
              <button type="button" disabled={cargando}
                onClick={() => correr(() => api.post(`/api/v1/usuarios/${cuenta.id}/reenviar-invitacion`, {}))}
                className="text-espera-ink underline shrink-0 disabled:opacity-40">
                Reenviar invitación
              </button>
            </div>
          )}

          {!cuenta.activo && !cuenta.pendiente && (
            <div className="flex items-center justify-between gap-3 text-xs bg-surface-app border border-line rounded-md px-3 py-2">
              <span className="text-ink-muted">Esta cuenta no tiene acceso.</span>
              <button type="button" disabled={cargando}
                onClick={() => correr(() => api.patch(`/api/v1/usuarios/${cuenta.id}`, { activo: true }))}
                className="text-ink-secondary underline shrink-0 disabled:opacity-40">
                Devolver acceso
              </button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cd-nombre">Nombre</Label>
            <Input id="cd-nombre" value={nombre} required onChange={e => setNombre(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cd-cargo">Cargo</Label>
            <Input id="cd-cargo" value={cargo} placeholder="Jefe de Terreno, Gerente HSE..."
                   onChange={e => setCargo(e.target.value)} />
          </div>

          {roles.length > 1 && (
            <div className="space-y-1.5">
              <Label>Qué puede hacer</Label>
              {roles.map(r => (
                <button key={r.v} type="button" onClick={() => setRol(r.v)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg border transition-colors",
                    rol === r.v ? "border-ink bg-surface-app" : "border-line hover:border-line-strong",
                  )}>
                  <span className={cn("text-sm font-medium", rol === r.v ? "text-ink" : "text-ink-muted")}>
                    {r.label}
                  </span>
                  <span className="block text-[10px] text-ink-subtle mt-0.5">{r.ayuda}</span>
                </button>
              ))}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {cuenta.activo || cuenta.pendiente ? (
              <button type="button" onClick={quitarAcceso} disabled={cargando}
                className="text-xs text-bloqueo-ink hover:underline mr-auto disabled:opacity-40">
                {cuenta.pendiente ? "Cancelar invitación" : "Quitar acceso"}
              </button>
            ) : <span className="mr-auto" />}
            <Button type="button" variant="outline" onClick={onClose} disabled={cargando}>Cerrar</Button>
            <Button type="submit" disabled={cargando}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
