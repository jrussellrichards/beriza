"use client"

import { useState } from "react"
import { Search, Plus, X, CheckCircle2, Users } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useApiData } from "@/shared/lib/use-api-data"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Rol = "berisa_admin" | "mandante_admin" | "prevencionista" | "contratista_admin"

interface Usuario {
  id: string; nombre: string; email: string
  rol: Rol; mandante?: string; activo: boolean; ultimo_acceso: string
}


const ROL_CFG: Record<Rol, { label: string; color: string }> = {
  berisa_admin:      { label: "BERISA Admin",   color: "bg-slate-900 text-white border-slate-900" },
  mandante_admin:    { label: "Mandante Admin", color: "bg-amber-50 text-amber-700 border-amber-200" },
  prevencionista:    { label: "Prevencionista", color: "bg-blue-50 text-blue-700 border-blue-200" },
  contratista_admin: { label: "Contratista",    color: "bg-purple-50 text-purple-700 border-purple-200" },
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
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Nuevo usuario</p>
          <p className="text-xs text-slate-400 mt-0.5">Se enviará invitación por email</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Nombre completo</label>
          <input
            value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="María González"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="mgonzalez@empresa.cl"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Rol</label>
          <div className="space-y-2">
            {(Object.entries(ROL_CFG) as [Rol, typeof ROL_CFG[Rol]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setRol(key)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                  rol === key ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"
                )}
              >
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0", cfg.color)}>
                  {cfg.label}
                </span>
                <span className="text-xs text-slate-500">
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

      <div className="px-6 py-4 border-t border-slate-100 shrink-0">
        <button
          onClick={handleGuardar}
          disabled={!nombre || !email}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
            guardado ? "bg-emerald-500 text-white"
              : !nombre || !email ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-slate-900 text-white hover:bg-slate-800"
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

  const { data: USUARIOS } = useApiData<Usuario[]>("/api/v1/admin/usuarios", [])

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
        <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Usuarios</h1>
              <p className="text-sm text-slate-500 mt-0.5">Todos los usuarios registrados en la plataforma</p>
            </div>
            <button
              onClick={() => setCreando(true)}
              className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
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
              { label: "Total usuarios", value: USUARIOS.length, color: "text-slate-900" },
              { label: "Activos", value: USUARIOS.filter(u => u.activo).length, color: "text-emerald-600" },
              { label: "Mandante admin", value: USUARIOS.filter(u => u.rol === "mandante_admin").length, color: "text-amber-600" },
              { label: "Contratistas", value: USUARIOS.filter(u => u.rol === "contratista_admin").length, color: "text-purple-600" },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
                <p className={cn("text-3xl font-semibold mt-1", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" placeholder="Buscar por nombre o email..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
              {ROLES_FILTRO.map(r => (
                <button
                  key={r}
                  onClick={() => setFiltroRol(r)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    filtroRol === r ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  {r === "TODOS" ? "Todos" : ROL_CFG[r].label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rol</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mandante</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Último acceso</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
                          u.activo ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-300"
                        )}>
                          {initials(u.nombre)}
                        </div>
                        <div>
                          <p className={cn("font-medium", u.activo ? "text-slate-900" : "text-slate-400")}>{u.nombre}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border", ROL_CFG[u.rol].color)}>
                        {ROL_CFG[u.rol].label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">{u.mandante ?? "—"}</td>
                    <td className="px-4 py-4">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", u.activo ? "text-emerald-600" : "text-slate-400")}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", u.activo ? "bg-emerald-500" : "bg-slate-300")} />
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-400">{u.ultimo_acceso}</td>
                    <td className="px-4 py-4">
                      <button className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-400">{filtrados.length} usuario{filtrados.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Panel nuevo usuario */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-20 transition-transform duration-300",
        creando ? "translate-x-0" : "translate-x-full"
      )}>
        {creando && <NuevoUsuarioPanel onClose={() => setCreando(false)} />}
      </div>
    </div>
  )
}
