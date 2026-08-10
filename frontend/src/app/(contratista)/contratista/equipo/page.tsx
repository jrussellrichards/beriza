"use client"

import { useCallback, useEffect, useState } from "react"
import { Mail, MoreHorizontal, RotateCw, UserPlus, Users } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { CuentaDialog } from "@/features/equipo/cuenta-dialog"

/** Espejo de GET /api/v1/usuarios/mi-equipo */
interface MiembroEquipo {
  id: string
  email: string
  nombre: string
  rol: string
  cargo: string | null
  activo: boolean
  /** Invitado que nunca entró. Distinto de una cuenta dada de baja. */
  pendiente: boolean
  /** El backend lo marca para que la UI no ofrezca acciones sobre uno mismo. */
  es_uno_mismo: boolean
}

const ROLES = [
  { v: "prevencionista", label: "Colaborador", ayuda: "Sube documentos y ve el estado" },
  { v: "contratista_admin", label: "Administrador", ayuda: "Además gestiona el equipo y la empresa" },
]

function etiquetaRol(rol: string) {
  return ROLES.find(r => r.v === rol)?.label ?? rol
}

function iniciales(nombre: string) {
  return nombre.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

function InvitarDialog({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const [email, setEmail] = useState("")
  const [nombre, setNombre] = useState("")
  const [cargo, setCargo] = useState("")
  const [rol, setRol] = useState("prevencionista")
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true); setError(null)
    try {
      await api.post("/api/v1/usuarios/mi-equipo/invitar", { email, nombre, rol, cargo: cargo || null })
      onCreado(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo invitar")
    } finally { setCargando(false) }
  }

  return (
    <Dialog open onOpenChange={() => !cargando && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Sumar a alguien de tu empresa</DialogTitle></DialogHeader>
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" value={email} required
                   placeholder="nombre@empresa.cl"
                   onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} required onChange={e => setNombre(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo (opcional)</Label>
            <Input id="cargo" value={cargo} placeholder="Jefe de RR.HH., Prevencionista..."
                   onChange={e => setCargo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Qué podrá hacer</Label>
            {ROLES.map(r => (
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
          <p className="text-xs text-ink-muted bg-surface-app border border-line-subtle rounded-md px-3 py-2">
            Le llega un correo para definir su propia contraseña. Hasta que lo haga, aparece
            como invitación pendiente.
          </p>
          {error && <p className="text-sm text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={cargando}>Cancelar</Button>
            <Button type="submit" disabled={cargando || !email.trim() || !nombre.trim()}>
              {cargando ? "Enviando..." : "Enviar invitación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Equipo del contratista: quién de su empresa entra a Acredita.
 *
 * Hasta ahora el contratista_admin era el único usuario posible de su empresa,
 * así que el jefe de RR.HH. y el prevencionista compartían una sola cuenta —y
 * con eso, la bitácora de quién subió cada documento dejaba de significar algo.
 */
export default function EquipoContratistaPage() {
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [invitando, setInvitando] = useState(false)
  const [editando, setEditando] = useState<MiembroEquipo | null>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    api.get<MiembroEquipo[]>("/api/v1/usuarios/mi-equipo")
      .then(setEquipo)
      .catch(e => setError(e instanceof Error ? e.message : "Error al cargar el equipo"))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function accion(fn: () => Promise<{ mensaje?: string }>, ) {
    setError(null); setAviso(null)
    try {
      const r = await fn()
      if (r?.mensaje) setAviso(r.mensaje)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción")
    }
  }

  const pendientes = equipo.filter(u => u.pendiente).length

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-semibold text-ink">Equipo</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Quién de tu empresa entra a Acredita
            {pendientes > 0 && ` · ${pendientes} invitación${pendientes > 1 ? "es" : ""} pendiente${pendientes > 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setInvitando(true)}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-surface-inverse text-white hover:bg-surface-inverse-hover transition-colors"
        >
          <UserPlus size={14} /> Sumar a alguien
        </button>
      </div>

      <div className="flex-1 px-6 sm:px-8 py-6 space-y-3">
        {aviso && (
          <p className="text-sm text-ok-ink bg-ok-soft border border-ok-line rounded-lg px-4 py-2">{aviso}</p>
        )}
        {error && (
          <p className="text-sm text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line rounded-lg px-4 py-2">{error}</p>
        )}

        {cargando && <p className="text-sm text-ink-muted">Cargando equipo...</p>}

        {!cargando && equipo.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <Users size={28} className="text-ink-subtle mb-3" />
            <p className="text-sm text-ink-secondary">Todavía estás solo en Acredita.</p>
          </div>
        )}

        {equipo.map(u => (
          <div key={u.id}
               className={cn(
                 "flex items-center gap-4 px-4 py-3 rounded-xl border bg-surface",
                 u.activo ? "border-line" : "border-line-subtle opacity-70",
               )}>
            <div className="w-9 h-9 rounded-full bg-surface-app border border-line flex items-center justify-center text-xs font-medium text-ink-secondary shrink-0">
              {iniciales(u.nombre)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-ink truncate">{u.nombre}</p>
                {u.es_uno_mismo && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border bg-surface-app text-ink-muted border-line">
                    tú
                  </span>
                )}
                {u.pendiente && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border bg-espera-soft text-espera-ink border-espera-line">
                    invitación pendiente
                  </span>
                )}
                {!u.activo && !u.pendiente && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border bg-surface-sunken text-ink-muted border-line">
                    sin acceso
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-subtle truncate">
                {u.email}{u.cargo ? ` · ${u.cargo}` : ""}
              </p>
            </div>

            <span className="text-xs text-ink-muted shrink-0">{etiquetaRol(u.rol)}</span>

            {/* Nunca se ofrecen acciones sobre uno mismo: el backend las rechaza
                con 403 y un botón que siempre falla es peor que no tenerlo. */}
            {!u.es_uno_mismo && (
              <div className="flex items-center gap-1.5 shrink-0">
                {u.pendiente && (
                  <button
                    title="Reenviar invitación"
                    onClick={() => accion(() => api.post(`/api/v1/usuarios/${u.id}/reenviar-invitacion`, {}))}
                    className="p-1.5 rounded-md text-ink-subtle hover:text-ink-secondary hover:bg-surface-app transition-colors"
                  >
                    <Mail size={14} />
                  </button>
                )}
                {!u.activo && !u.pendiente && (
                  <button
                    title="Devolver el acceso"
                    onClick={() => accion(() => api.patch(`/api/v1/usuarios/${u.id}`, { activo: true }))}
                    className="p-1.5 rounded-md text-ink-subtle hover:text-ok-ink hover:bg-surface-app transition-colors"
                  >
                    <RotateCw size={14} />
                  </button>
                )}
                <button
                  onClick={() => setEditando(u)}
                  className="p-1.5 rounded-md text-ink-subtle hover:text-ink-secondary hover:bg-surface-app transition-colors"
                  title="Editar"
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {invitando && <InvitarDialog onClose={() => setInvitando(false)} onCreado={cargar} />}

      {editando && (
        <CuentaDialog
          cuenta={editando}
          roles={ROLES}
          onClose={() => setEditando(null)}
          onCambio={() => { setEditando(null); cargar() }}
          onAviso={setAviso}
          onError={setError}
        />
      )}
    </div>
  )
}
