"use client"

import { useState, useEffect } from "react"
import { Save, Building2, Mail, Globe, Bell, Shield, Users, CheckCircle2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useApiData } from "@/shared/lib/use-api-data"
import { getSession } from "@/shared/lib/auth"
import { api } from "@/shared/lib/api"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ConfigSeccion {
  id: string
  titulo: string
  descripcion: string
  icon: React.ElementType
}

import { UsuarioPermisosDialog, type UsuarioEquipo } from "@/features/mandante/usuario-permisos-dialog"

interface ConfigData {
  razon_social: string; rut: string; email_contacto: string; sitio_web: string
  equipo: UsuarioEquipo[]
}

// ── Config estática ───────────────────────────────────────────────────────────

const SECCIONES: ConfigSeccion[] = [
  { id: "organizacion", titulo: "Organización", descripcion: "Datos del mandante", icon: Building2 },
  { id: "notificaciones", titulo: "Notificaciones", descripcion: "Alertas y avisos", icon: Bell },
  { id: "seguridad", titulo: "Seguridad", descripcion: "Auth y sesiones", icon: Shield },
]

const ROL_DEFAULT = { label: "Usuario", color: "bg-surface-app text-ink-muted border-line" }

const ROL_CFG: Record<string, { label: string; color: string }> = {
  mandante_admin: { label: "Admin", color: "bg-accion-soft text-accion-ink border-accion-line" },
  prevencionista: { label: "Prevencionista", color: "bg-brand-soft text-brand-hover border-brand-line" },
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-surface-inverse" : "bg-line"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 rounded-full bg-surface shadow-sm transition-transform",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const [seccion, setSeccion] = useState("organizacion")
  const [saved, setSaved] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [mandanteId, setMandanteId] = useState<string | null>(null)
  const [dialogo, setDialogo] = useState<{ usuario: UsuarioEquipo | null } | null>(null)

  useEffect(() => {
    const s = getSession()
    if (s?.mandante_id) {
      setMandanteId(s.mandante_id)
      setEndpoint(`/api/v1/mandantes/${s.mandante_id}/configuracion`)
    }
  }, [])

  const FALLBACK: ConfigData = { razon_social: "", rut: "", email_contacto: "", sitio_web: "", equipo: [] }
  const { data: config, refetch } = useApiData<ConfigData>(endpoint, FALLBACK)

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

  async function handleSave() {
    if (!mandanteId) return
    setGuardando(true)
    setErrorGuardado(null)
    try {
      await api.patch(`/api/v1/mandantes/${mandanteId}`, {
        razon_social: razonSocial,
        email_contacto: email,
        sitio_web: sitioWeb,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setErrorGuardado(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-ink">Configuración</h1>
            <p className="text-sm text-ink-muted mt-0.5">Ajustes de tu organización y cuenta</p>
          </div>
          <button
            onClick={handleSave}
            disabled={guardando}
            className={cn(
              "flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all",
              saved ? "bg-ok-ink text-white" : "bg-surface-inverse text-white hover:bg-surface-inverse-hover",
              guardando && "opacity-60 cursor-not-allowed"
            )}
          >
            {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {guardando ? "Guardando..." : saved ? "¡Guardado!" : "Guardar cambios"}
          </button>
        </div>
        {errorGuardado && (
          <p className="mt-3 text-sm text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line rounded-lg px-4 py-2">{errorGuardado}</p>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Nav lateral */}
        <div className="w-52 shrink-0 border-r border-line-subtle bg-surface-app/50 p-3 space-y-0.5">
          {SECCIONES.map(s => {
            const Icon = s.icon
            const active = seccion === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSeccion(s.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                  active ? "bg-surface border border-line shadow-sm" : "hover:bg-surface/60"
                )}
              >
                <Icon size={15} className={active ? "text-ink" : "text-ink-subtle"} />
                <div>
                  <p className={cn("text-sm font-medium", active ? "text-ink" : "text-ink-muted")}>{s.titulo}</p>
                  <p className="text-[10px] text-ink-subtle">{s.descripcion}</p>
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
                <h2 className="text-base font-semibold text-ink mb-1">Datos de la organización</h2>
                <p className="text-sm text-ink-subtle">Información del mandante mostrada a los contratistas</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink-secondary">Razón social</label>
                  <div className="relative">
                    <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                    <input
                      value={razonSocial}
                      onChange={e => setRazonSocial(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-line-strong"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink-secondary">RUT</label>
                  <input
                    value={rut}
                    onChange={e => setRut(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-line rounded-lg bg-surface font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-line-strong"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink-secondary">Email de contacto</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-line-strong"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink-secondary">Sitio web</label>
                  <div className="relative">
                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                    <input
                      value={sitioWeb}
                      onChange={e => setSitioWeb(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-line-strong"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-line-subtle pt-5">
                <h3 className="text-sm font-semibold text-ink mb-3">Alertas de vencimiento</h3>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-ink-muted">Avisar con</label>
                  <input
                    type="number"
                    value={diasAviso}
                    onChange={e => setDiasAviso(e.target.value)}
                    className="w-16 px-2 py-1.5 text-sm border border-line rounded-lg bg-surface text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                  <label className="text-sm text-ink-muted">días de anticipación</label>
                </div>
              </div>
            </div>
          )}

          {/* Notificaciones */}
          {seccion === "notificaciones" && (
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-ink mb-1">Notificaciones por email</h2>
                <p className="text-sm text-ink-subtle">Controla qué alertas recibes en tu correo</p>
              </div>
              <p className="text-xs text-accion-ink bg-accion-soft border border-accion-line rounded-lg px-4 py-2.5">
                Estas preferencias aún no se guardan — la configuración de notificaciones está en desarrollo.
              </p>

              <div className="bg-surface rounded-xl border border-line divide-y divide-slate-100">
                {[
                  { label: "Documentos próximos a vencer", desc: "Aviso cuando un documento vence en los próximos días configurados", value: notifVencimiento, set: setNotifVencimiento },
                  { label: "Nueva brecha detectada por IA", desc: "Cuando el sistema rechaza un documento de un contratista", value: notifBrecha, set: setNotifBrecha },
                  { label: "Contratista acreditado", desc: "Cuando una empresa completa todos los requisitos exigidos", value: notifAcreditacion, set: setNotifAcreditacion },
                  { label: "Resumen semanal", desc: "Informe con estado global cada lunes a las 8:00 AM", value: notifResumen, set: setNotifResumen },
                ].map(n => (
                  <div key={n.label} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-ink">{n.label}</p>
                      <p className="text-xs text-ink-subtle mt-0.5">{n.desc}</p>
                    </div>
                    <Toggle checked={n.value} onChange={n.set} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seguridad */}
          {seccion === "seguridad" && (
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-ink mb-1">Seguridad de la cuenta</h2>
                <p className="text-sm text-ink-subtle">Configuración de autenticación y sesiones</p>
              </div>
              <p className="text-xs text-accion-ink bg-accion-soft border border-accion-line rounded-lg px-4 py-2.5">
                Estas preferencias aún no se guardan — la configuración de seguridad está en desarrollo.
              </p>

              <div className="bg-surface rounded-xl border border-line divide-y divide-slate-100">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-ink">Doble factor de autenticación (2FA)</p>
                    <p className="text-xs text-ink-subtle mt-0.5">Requiere código adicional al iniciar sesión</p>
                  </div>
                  <Toggle checked={sesion2fa} onChange={setSesion2fa} />
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm font-medium text-ink mb-1">Duración de sesión</p>
                  <p className="text-xs text-ink-subtle mb-3">Cierra sesión automáticamente después de</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={sesionDias}
                      onChange={e => setSesionDias(e.target.value)}
                      className="w-16 px-2 py-1.5 text-sm border border-line rounded-lg bg-surface text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                    <span className="text-sm text-ink-muted">días de inactividad</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-bloqueo-line bg-bloqueo-soft p-4">
                <p className="text-sm font-semibold text-bloqueo-ink mb-1">Zona de peligro</p>
                <p className="text-xs text-bloqueo-ink mb-3">Estas acciones son irreversibles. Procede con cuidado.</p>
                <button disabled title="Eliminar la cuenta requiere contactar a BERISA" className="text-xs font-medium text-bloqueo-ink border border-bloqueo-line bg-surface hover:bg-bloqueo-soft px-3 py-2 rounded-md transition-colors">Eliminar cuenta del mandante</button>
              </div>
            </div>
          )}

        </div>
      </div>

      {dialogo && mandanteId && (
        <UsuarioPermisosDialog
          mandanteId={mandanteId}
          usuario={dialogo.usuario}
          onClose={() => setDialogo(null)}
          onGuardado={refetch}
        />
      )}
    </div>
  )
}
