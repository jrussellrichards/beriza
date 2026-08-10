"use client"

import { useState } from "react"
import { Search, Plus, X, CheckCircle2, Users } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useApiData } from "@/shared/lib/use-api-data"
import { CuentaDialog } from "@/features/equipo/cuenta-dialog"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Rol = "berisa_admin" | "mandante_admin" | "prevencionista" | "contratista_admin"

interface Usuario {
  id: string; nombre: string; email: string
  rol: Rol; mandante?: string; activo: boolean
  cargo: string | null
  /** Invitación que nunca se activó. Distinto de una cuenta dada de baja. */
  pendiente: boolean
  es_uno_mismo: boolean
  /** Antigüedad de la cuenta. NO es un último acceso: no hay registro de login. */
  ultimo_acceso: string
}

/** BERISA puede otorgar cualquier rol. El backend lo revalida. */
const ROLES_BERISA = [
  { v: "prevencionista", label: "Revisor / Colaborador", ayuda: "Sin administración de la cuenta" },
  { v: "mandante_admin", label: "Admin de mandante", ayuda: "Administra la organización del mandante" },
  { v: "contratista_admin", label: "Admin de contratista", ayuda: "Administra la empresa contratista" },
  { v: "berisa_admin", label: "BERISA Admin", ayuda: "Opera la plataforma completa" },
]


const ROL_CFG: Record<Rol, { label: string; color: string }> = {
  berisa_admin:      { label: "BERISA Admin",   color: "bg-surface-inverse text-white border-ink" },
  mandante_admin:    { label: "Mandante Admin", color: "bg-accion-soft text-accion-ink border-accion-line" },
  prevencionista:    { label: "Prevencionista", color: "bg-brand-soft text-brand-hover border-brand-line" },
  contratista_admin: { label: "Contratista",    color: "bg-excepcion-soft text-excepcion-ink border-excepcion-line" },
}

const ROLES_FILTRO: (Rol | "TODOS")[] = ["TODOS", "berisa_admin", "mandante_admin", "prevencionista", "contratista_admin"]

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

// ── Panel nuevo usuario ───────────────────────────────────────────────────────

function NuevoUsuarioPanel({ onClose }: { onClose: () => void }) {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [rol, setRol] = useState<Rol>("mandante_admin")
  const [guardado, setGuardado] = useState(false)

  function handleGuardar() {
    if (!nombre || !email) return
    setGuardado(true)
    setTimeout(() => { setGuardado(false); onClose() }, 1500)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-line-subtle flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Nuevo usuario</p>
          <p className="text-xs text-ink-subtle mt-0.5">Se enviará invitación por email</p>
        </div>
        <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-secondary">Nombre completo</label>
          <input
            value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="María González"
            className="w-full px-3 py-2.5 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-secondary">Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="mgonzalez@empresa.cl"
            className="w-full px-3 py-2.5 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-secondary">Rol</label>
          <div className="space-y-2">
            {(Object.entries(ROL_CFG) as [Rol, typeof ROL_CFG[Rol]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setRol(key)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                  rol === key ? "border-ink bg-surface-app" : "border-line hover:border-line-strong"
                )}
              >
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0", cfg.color)}>
                  {cfg.label}
                </span>
                <span className="text-xs text-ink-muted">
                  {key === "berisa_admin" ? "Acceso total a la plataforma" :
                    key === "mandante_admin" ? "Gestiona contratistas de su mandante" :
                      key === "prevencionista" ? "Visualiza y sube documentos" :
                        "Gestiona su empresa y trabajadores"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-line-subtle shrink-0">
        <button
          onClick={handleGuardar}
          disabled={!nombre || !email}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
            guardado ? "bg-ok-ink text-white"
              : !nombre || !email ? "bg-line text-ink-subtle cursor-not-allowed"
                : "bg-surface-inverse text-white hover:bg-surface-inverse-hover"
          )}
        >
          {guardado ? <><CheckCircle2 size={14} /> Invitación enviada</> : "Crear y enviar invitación"}
        </button>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const [busqueda, setBusqueda] = useState("")
  const [filtroRol, setFiltroRol] = useState<Rol | "TODOS">("TODOS")
  const [creando, setCreando] = useState(false)

  const { data: USUARIOS, refetch } = useApiData<Usuario[]>("/api/v1/admin/usuarios", [])
  const [cuenta, setCuenta] = useState<Usuario | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const filtrados = USUARIOS.filter(u => {
    const matchQ = u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.email.toLowerCase().includes(busqueda.toLowerCase())
    const matchR = filtroRol === "TODOS" || u.rol === filtroRol
    return matchQ && matchR
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", creando ? "mr-96" : "")}>

        {/* Header */}
        <div className="px-8 py-6 border-b border-line bg-surface shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-ink">Usuarios</h1>
              <p className="text-sm text-ink-muted mt-0.5">Todos los usuarios registrados en la plataforma</p>
            </div>
            <button
              onClick={() => setCreando(true)}
              className="flex items-center gap-2 bg-surface-inverse text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
            >
              <Plus size={15} />
              Nuevo usuario
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6 space-y-5">

          {/* KPI mini */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total usuarios", value: USUARIOS.length, color: "text-ink" },
              { label: "Activos", value: USUARIOS.filter(u => u.activo).length, color: "text-ok-ink" },
              { label: "Mandante admin", value: USUARIOS.filter(u => u.rol === "mandante_admin").length, color: "text-accion-ink" },
              { label: "Contratistas", value: USUARIOS.filter(u => u.rol === "contratista_admin").length, color: "text-excepcion-ink" },
            ].map(k => (
              <div key={k.label} className="bg-surface rounded-xl border border-line px-5 py-4">
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">{k.label}</p>
                <p className={cn("text-3xl font-semibold mt-1", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text" placeholder="Buscar por nombre o email..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="flex items-center gap-1 bg-surface border border-line rounded-lg p-1">
              {ROLES_FILTRO.map(r => (
                <button
                  key={r}
                  onClick={() => setFiltroRol(r)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    filtroRol === r ? "bg-surface-inverse text-white" : "text-ink-muted hover:text-ink"
                  )}
                >
                  {r === "TODOS" ? "Todos" : ROL_CFG[r].label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-subtle bg-surface-app/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Rol</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Mandante</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Creado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtrados.map(u => (
                  <tr key={u.id} className="hover:bg-surface-app/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
                          u.activo ? "bg-surface-sunken text-ink-muted" : "bg-surface-app text-ink-subtle"
                        )}>
                          {initials(u.nombre)}
                        </div>
                        <div>
                          <p className={cn("font-medium", u.activo ? "text-ink" : "text-ink-subtle")}>{u.nombre}</p>
                          <p className="text-xs text-ink-subtle">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border", ROL_CFG[u.rol].color)}>
                        {ROL_CFG[u.rol].label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-ink-muted">{u.mandante ?? "—"}</td>
                    <td className="px-4 py-4">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", u.activo ? "text-ok-ink" : "text-ink-subtle")}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", u.activo ? "bg-ok-ink" : "bg-line-strong")} />
                        {u.activo ? "Activo" : u.pendiente ? "Invitación pendiente" : "Sin acceso"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-ink-subtle">{u.ultimo_acceso}</td>
                    <td className="px-4 py-4">
                      {/* Sobre uno mismo no se ofrece: el backend rechaza
                          desactivarse y cambiarse el rol con 403. */}
                      {!u.es_uno_mismo && (
                        <button
                          onClick={() => setCuenta(u)}
                          className="text-xs text-ink-muted hover:text-ink px-2 py-1 rounded hover:bg-surface-sunken transition-colors"
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-line-subtle bg-surface-app/50">
              <p className="text-xs text-ink-subtle">{filtrados.length} usuario{filtrados.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {(aviso || errorAccion) && (
        <div className="px-6 sm:px-8 pb-4">
          <p className={cn(
            "text-sm px-4 py-2 rounded-lg border",
            errorAccion
              ? "text-bloqueo-ink bg-bloqueo-soft border-bloqueo-line"
              : "text-ok-ink bg-ok-soft border-ok-line",
          )}>{errorAccion || aviso}</p>
        </div>
      )}

      {/* Panel nuevo usuario */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-surface border-l border-line shadow-xl z-20 transition-transform duration-300",
        creando ? "translate-x-0" : "translate-x-full"
      )}>
        {creando && <NuevoUsuarioPanel onClose={() => setCreando(false)} />}
      </div>

      {cuenta && (
        <CuentaDialog
          cuenta={cuenta}
          roles={ROLES_BERISA}
          onClose={() => setCuenta(null)}
          onCambio={() => { setCuenta(null); refetch() }}
          onAviso={setAviso}
          onError={setErrorAccion}
        />
      )}
    </div>
  )
}
