"use client"

import { useState, useEffect } from "react"
import { Save, Building2, Mail, Globe, Bell, Shield, Users, CheckCircle2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useApiData } from "@/shared/lib/use-api-data"
import { getSession } from "@/shared/lib/auth"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ConfigSeccion {
  id: string
  titulo: string
  descripcion: string
  icon: React.ElementType
}

interface UsuarioEquipo {
  id: string; nombre: string; email: string; rol: string; activo: boolean
}

interface ConfigData {
  razon_social: string; rut: string; email_contacto: string; sitio_web: string
  equipo: UsuarioEquipo[]
}

// ── Config estática ───────────────────────────────────────────────────────────

const SECCIONES: ConfigSeccion[] = [
  { id: "organizacion", titulo: "Organización", descripcion: "Datos del mandante", icon: Building2 },
  { id: "notificaciones", titulo: "Notificaciones", descripcion: "Alertas y avisos", icon: Bell },
  { id: "acceso", titulo: "Acceso y usuarios", descripcion: "Equipo con acceso", icon: Users },
  { id: "seguridad", titulo: "Seguridad", descripcion: "Auth y sesiones", icon: Shield },
]

const ROL_CFG: Record<string, { label: string; color: string }> = {
  mandante_admin: { label: "Admin", color: "bg-amber-50 text-amber-700 border-amber-200" },
  prevencionista: { label: "Prevencionista", color: "bg-blue-50 text-blue-700 border-blue-200" },
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-slate-900" : "bg-slate-200"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const [seccion, setSeccion] = useState("organizacion")
  const [saved, setSaved] = useState(false)
  const [endpoint, setEndpoint] = useState<string | null>(null)

  useEffect(() => {
    const s = getSession()
    if (s?.mandante_id) setEndpoint(`/api/v1/mandantes/${s.mandante_id}/configuracion`)
  }, [])

  const FALLBACK: ConfigData = { razon_social: "", rut: "", email_contacto: "", sitio_web: "", equipo: [] }
  const { data: config } = useApiData<ConfigData>(endpoint, FALLBACK)

  // Organización
  const [razonSocial, setRazonSocial] = useState("")
  const [rut, setRut] = useState("")
  const [email, setEmail] = useState("")
  const [sitioWeb, setSitioWeb] = useState("")
  const [diasAviso, setDiasAviso] = useState("15")

  useEffect(() => {
    if (config.razon_social) {
      setRazonSocial(config.razon_social)
      setRut(config.rut)
      setEmail(config.email_contacto)
      setSitioWeb(config.sitio_web)
    }
  }, [config])

  // Notificaciones
  const [notifVencimiento, setNotifVencimiento] = useState(true)
  const [notifBrecha, setNotifBrecha] = useState(true)
  const [notifAcreditacion, setNotifAcreditacion] = useState(true)
  const [notifResumen, setNotifResumen] = useState(false)

  // Seguridad
  const [sesion2fa, setSesion2fa] = useState(false)
  const [sesionDias, setSesionDias] = useState("7")

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Configuración</h1>
            <p className="text-sm text-slate-500 mt-0.5">Ajustes de tu organización y cuenta</p>
          </div>
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all",
              saved ? "bg-emerald-500 text-white" : "bg-slate-900 text-white hover:bg-slate-800"
            )}
          >
            {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saved ? "¡Guardado!" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Nav lateral */}
        <div className="w-52 shrink-0 border-r border-slate-100 bg-slate-50/50 p-3 space-y-0.5">
          {SECCIONES.map(s => {
            const Icon = s.icon
            const active = seccion === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSeccion(s.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                  active ? "bg-white border border-slate-200 shadow-sm" : "hover:bg-white/60"
                )}
              >
                <Icon size={15} className={active ? "text-slate-800" : "text-slate-400"} />
                <div>
                  <p className={cn("text-sm font-medium", active ? "text-slate-900" : "text-slate-500")}>{s.titulo}</p>
                  <p className="text-[10px] text-slate-400">{s.descripcion}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-auto p-8">

          {/* Organización */}
          {seccion === "organizacion" && (
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">Datos de la organización</h2>
                <p className="text-sm text-slate-400">Información del mandante mostrada a los contratistas</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Razón social</label>
                  <div className="relative">
                    <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={razonSocial}
                      onChange={e => setRazonSocial(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">RUT</label>
                  <input
                    value={rut}
                    onChange={e => setRut(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Email de contacto</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Sitio web</label>
                  <div className="relative">
                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={sitioWeb}
                      onChange={e => setSitioWeb(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Alertas de vencimiento</h3>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-600">Avisar con</label>
                  <input
                    type="number"
                    value={diasAviso}
                    onChange={e => setDiasAviso(e.target.value)}
                    className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                  <label className="text-sm text-slate-600">días de anticipación</label>
                </div>
              </div>
            </div>
          )}

          {/* Notificaciones */}
          {seccion === "notificaciones" && (
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">Notificaciones por email</h2>
                <p className="text-sm text-slate-400">Controla qué alertas recibes en tu correo</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {[
                  { label: "Documentos próximos a vencer", desc: "Aviso cuando un documento vence en los próximos días configurados", value: notifVencimiento, set: setNotifVencimiento },
                  { label: "Nueva brecha detectada por IA", desc: "Cuando el sistema rechaza un documento de un contratista", value: notifBrecha, set: setNotifBrecha },
                  { label: "Contratista acreditado", desc: "Cuando una empresa completa todos los requisitos exigidos", value: notifAcreditacion, set: setNotifAcreditacion },
                  { label: "Resumen semanal", desc: "Informe con estado global cada lunes a las 8:00 AM", value: notifResumen, set: setNotifResumen },
                ].map(n => (
                  <div key={n.label} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{n.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.desc}</p>
                    </div>
                    <Toggle checked={n.value} onChange={n.set} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acceso y usuarios */}
          {seccion === "acceso" && (
            <div className="max-w-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 mb-1">Equipo con acceso</h2>
                  <p className="text-sm text-slate-400">Usuarios que pueden gestionar la plataforma</p>
                </div>
                <button className="flex items-center gap-2 text-sm font-medium border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-700">
                  <Users size={14} />
                  Invitar usuario
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {config.equipo.map(u => (
                  <div key={u.email} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                      {u.nombre.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium", u.activo ? "text-slate-900" : "text-slate-400")}>{u.nombre}</p>
                      <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                    </div>
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border", ROL_CFG[u.rol].color)}>
                      {ROL_CFG[u.rol].label}
                    </span>
                    <span className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded border",
                      u.activo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200"
                    )}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                    <button className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded hover:bg-slate-100">
                      Editar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seguridad */}
          {seccion === "seguridad" && (
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">Seguridad de la cuenta</h2>
                <p className="text-sm text-slate-400">Configuración de autenticación y sesiones</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Doble factor de autenticación (2FA)</p>
                    <p className="text-xs text-slate-400 mt-0.5">Requiere código adicional al iniciar sesión</p>
                  </div>
                  <Toggle checked={sesion2fa} onChange={setSesion2fa} />
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm font-medium text-slate-800 mb-1">Duración de sesión</p>
                  <p className="text-xs text-slate-400 mb-3">Cierra sesión automáticamente después de</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={sesionDias}
                      onChange={e => setSesionDias(e.target.value)}
                      className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                    <span className="text-sm text-slate-600">días de inactividad</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800 mb-1">Zona de peligro</p>
                <p className="text-xs text-red-600 mb-3">Estas acciones son irreversibles. Procede con cuidado.</p>
                <button className="text-xs font-medium text-red-700 border border-red-300 bg-white hover:bg-red-50 px-3 py-2 rounded-md transition-colors">
                  Eliminar cuenta del mandante
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
