"use client"

import { useState } from "react"
import {
  Plus, Search, ChevronRight, X, Building2,
  Users, CheckCircle2, AlertCircle, Globe,
  Mail, Calendar, ToggleLeft, ToggleRight
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { useApiData } from "@/shared/lib/use-api-data"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Plan = "Enterprise" | "Pro" | "Starter"

interface Mandante {
  id: string
  nombre: string
  rut: string
  email: string
  sitio_web: string
  plan: Plan
  activo: boolean
  contratistas: number
  acreditadas: number
  requisitos_exigidos: number
  perfiles: number
  fecha_creacion: string
  contacto: string
}

// API type from /api/v1/admin/mandantes
interface ApiMandante {
  id: string; razon_social: string; rut: string; plan: string; activo: boolean
  email_contacto: string | null; sitio_web: string | null; total_contratistas: number
  acreditadas: number; pct_acreditacion: number; fecha_creacion: string
  requisitos_exigidos: number; perfiles: number
}

function mapMandante(a: ApiMandante): Mandante {
  return {
    id: a.id, nombre: a.razon_social, rut: a.rut,
    email: a.email_contacto ?? "", sitio_web: a.sitio_web ?? "",
    plan: (a.plan as Plan) || "Pro", activo: a.activo,
    contratistas: a.total_contratistas, acreditadas: a.acreditadas,
    requisitos_exigidos: a.requisitos_exigidos, perfiles: a.perfiles,
    fecha_creacion: a.fecha_creacion, contacto: "",
  }
}

/**
 * Un plan que no esté en esta tabla NO puede tumbar la pantalla. El backend no
 * valida el valor contra una lista, así que cualquier plan nuevo —o creado por
 * API— llegaba acá como una clave inexistente y `planCfg(m.plan).color`
 * reventaba el render completo del panel de mandantes, no sólo esa fila.
 */
function planCfg(plan: string): { label: string; color: string } {
  return PLAN_CFG[plan as Plan] ?? {
    label: plan || "Sin plan",
    color: "bg-surface-sunken text-ink-muted border-line",
  }
}

const PLAN_CFG: Record<Plan, { label: string; color: string }> = {
  Enterprise: { label: "Enterprise", color: "bg-accion-soft text-accion-ink border-accion-line" },
  Pro:        { label: "Pro",        color: "bg-brand-soft text-brand-hover border-brand-line" },
  Starter:    { label: "Starter",    color: "bg-surface-sunken text-ink-muted border-line" },
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

// ── Formulario nuevo mandante ─────────────────────────────────────────────────

/**
 * Invita a un mandante: crea la empresa y su usuario mandante_admin inactivo, y
 * le envía el email de activación. Mismo flujo con el que un mandante invita a
 * un contratista — el invitado define su contraseña al activar, BERISA nunca la
 * conoce.
 */
function NuevoMandantePanel({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState("")
  const [rut, setRut] = useState("")
  const [email, setEmail] = useState("")
  const [plan, setPlan] = useState<Plan>("Pro")
  const [guardado, setGuardado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkRespaldo, setLinkRespaldo] = useState<string | null>(null)

  async function handleGuardar() {
    if (!nombre || !rut || !email) return
    setEnviando(true)
    setError(null)
    setLinkRespaldo(null)
    try {
      const r = await api.post<{ mensaje: string; link_activacion?: string }>(
        "/api/v1/mandantes/invitar",
        { razon_social: nombre, rut, email, plan },
      )
      onCreado()
      if (r.link_activacion) {
        // El email no salió (dominio sin verificar en Resend): se muestra el
        // link para que BERISA lo entregue por otro medio, en vez de dejar al
        // mandante sin forma de entrar.
        setLinkRespaldo(r.link_activacion)
        return
      }
      setGuardado(true)
      setTimeout(() => { setGuardado(false); onClose() }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo invitar al mandante")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-line-subtle flex items-center justify-between">
        <div>
          <p className="text-strong font-semibold text-ink">Nuevo mandante</p>
          <p className="text-meta text-ink-subtle mt-0.5">Se enviará invitación al email indicado</p>
        </div>
        <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-strong font-medium text-ink-secondary">Razón social</label>
          <input
            value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Empresa S.A."
            className="w-full px-3 py-2.5 text-body border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-strong font-medium text-ink-secondary">RUT empresa</label>
          <input
            value={rut} onChange={e => setRut(e.target.value)}
            placeholder="76.123.456-7"
            className="w-full px-3 py-2.5 text-body border border-line rounded-lg bg-surface font-mono focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-strong font-medium text-ink-secondary">Email administrador</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="admin@empresa.cl"
            className="w-full px-3 py-2.5 text-body border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-strong font-medium text-ink-secondary">Plan</label>
          <div className="grid grid-cols-3 gap-2">
            {(["Starter", "Pro", "Enterprise"] as Plan[]).map(p => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={cn(
                  "py-2 rounded-lg border text-strong font-medium transition-colors",
                  plan === p ? "border-ink bg-surface-inverse text-white" : "border-line text-ink-muted hover:border-line-strong"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-brand-soft border border-brand-line p-3 text-meta text-brand-hover">
          Se le envía un email para que active su cuenta y defina su propia contraseña.
          Al entrar podrá configurar qué requisitos exige e invitar a sus contratistas.
        </div>

        {error && (
          <p className="text-body text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line px-3 py-2 rounded-lg">{error}</p>
        )}

        {linkRespaldo && (
          <div className="rounded-lg bg-accion-soft border border-accion-line p-3 space-y-2">
            <p className="text-meta text-accion-ink">
              El mandante se creó, pero el email no pudo enviarse. Entrégale este enlace
              de activación por otro medio:
            </p>
            <code className="block text-[10px] bg-surface border border-accion-line rounded px-2 py-1.5 break-all text-ink-secondary">
              {linkRespaldo}
            </code>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-line-subtle shrink-0">
        <button
          onClick={handleGuardar}
          disabled={!nombre || !rut || !email || enviando}
          className={cn(
            "w-full py-2.5 rounded-lg text-strong font-medium transition-all flex items-center justify-center gap-2",
            guardado
              ? "bg-ok-ink text-white"
              : !nombre || !rut || !email
                ? "bg-line text-ink-subtle cursor-not-allowed"
                : "bg-surface-inverse text-white hover:bg-surface-inverse-hover"
          )}
        >
          {guardado ? <><CheckCircle2 size={14} /> Mandante creado</> : "Crear y enviar invitación"}
        </button>
      </div>
    </div>
  )
}

// ── Panel detalle mandante ────────────────────────────────────────────────────

function DetalleMandante({ m, onClose }: { m: Mandante; onClose: () => void }) {
  // Sin contratistas no hay porcentaje: 0/0 daba NaN% con la barra en rojo,
  // insinuando incumplimiento donde todavia no hay nada que cumplir.
  const pct = m.contratistas > 0 ? Math.round((m.acreditadas / m.contratistas) * 100) : null
  const barColor = pct === null ? "bg-line" : pct >= 75 ? "bg-ok-ink" : pct >= 50 ? "bg-accion-line" : "bg-bloqueo-ink"

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-line-subtle flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-sunken text-ink-muted text-micro font-semibold flex items-center justify-center shrink-0">
            {initials(m.nombre)}
          </div>
          <div>
            <p className="text-strong font-semibold text-ink">{m.nombre}</p>
            <p className="text-meta text-ink-subtle font-mono">{m.rut}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted shrink-0"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border", planCfg(m.plan).color)}>
            {planCfg(m.plan).label}
          </span>
          <span className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded border",
            m.activo ? "bg-ok-soft text-ok-ink border-ok-line" : "bg-surface-sunken text-ink-subtle border-line"
          )}>
            {m.activo ? "Activo" : "Inactivo"}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Contratistas", value: m.contratistas, icon: Users },
            { label: "Acreditados", value: m.acreditadas, icon: CheckCircle2 },
            { label: "Requisitos exigidos", value: m.requisitos_exigidos, icon: AlertCircle },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className="rounded-lg bg-surface-app border border-line-subtle p-3 text-center">
                <Icon size={14} className="text-ink-subtle mx-auto mb-1" />
                <p className="text-title font-semibold text-ink">{s.value}</p>
                <p className="text-[10px] text-ink-subtle">{s.label}</p>
              </div>
            )
          })}
        </div>

        {/* Barra acreditación */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-micro font-medium text-ink-muted">Tasa de acreditación</p>
            <span className="text-micro font-semibold text-ink-secondary">{pct === null ? "—" : `${pct}%`}</span>
          </div>
          <div className="h-2 bg-surface-sunken rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct ?? 0}%` }} />
          </div>
        </div>

        {/* Info */}
        <div className="space-y-3">
          {[
            { icon: Mail, label: "Email", value: m.email },
            { icon: Globe, label: "Sitio web", value: m.sitio_web },
            { icon: Users, label: "Contacto", value: m.contacto },
            { icon: Calendar, label: "Alta en plataforma", value: m.fecha_creacion },
          ].map(f => {
            const Icon = f.icon
            return (
              <div key={f.label} className="flex items-center gap-3">
                <Icon size={13} className="text-ink-subtle shrink-0" />
                <div>
                  <p className="text-[10px] text-ink-subtle">{f.label}</p>
                  <p className="text-body text-ink">{f.value}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Acciones. Las que no tienen endpoint detras van deshabilitadas y con
            el motivo: un boton que parece funcionar y no hace nada es peor que
            un boton apagado, sobre todo en una demo. */}
        <div className="border-t border-line-subtle pt-4 space-y-2">
          <button
            onClick={() => window.location.href = "/admin/mandantes"}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-line text-body text-ink-secondary hover:bg-surface-app transition-colors"
          >
            <span>Ver contratistas del mandante</span>
            <ChevronRight size={14} className="text-ink-subtle" />
          </button>
          <button
            disabled
            title="El cambio de plan aún no está implementado"
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-line-subtle text-body text-ink-subtle cursor-not-allowed"
          >
            <span>Cambiar plan</span>
            <span className="text-[10px]">no disponible</span>
          </button>
          <button
            disabled
            title="Activar y desactivar mandantes aún no está implementado"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-line-subtle text-strong font-medium text-ink-subtle cursor-not-allowed"
          >
            {m.activo ? <><ToggleLeft size={14} /> Desactivar mandante</> : <><ToggleRight size={14} /> Activar mandante</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function MandantesPage() {
  const [busqueda, setBusqueda] = useState("")
  const [seleccionado, setSeleccionado] = useState<Mandante | null>(null)
  const [creando, setCreando] = useState(false)

  const { data: apiMandantes, refetch } = useApiData<ApiMandante[]>("/api/v1/admin/mandantes", [])
  const MANDANTES = apiMandantes.map(mapMandante)

  const filtrados = MANDANTES.filter(m =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    m.rut.includes(busqueda)
  )

  function abrirPanel(m: Mandante) {
    setCreando(false)
    setSeleccionado(prev => prev?.id === m.id ? null : m)
  }

  function abrirCrear() {
    setSeleccionado(null)
    setCreando(true)
  }

  const panelAbierto = !!seleccionado || creando

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", panelAbierto ? "mr-96" : "")}>

        {/* Header */}
        <div className="px-8 py-6 border-b border-line bg-surface shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-title font-semibold text-ink">Mandantes</h1>
              <p className="text-body text-ink-muted mt-0.5">Empresas registradas en la plataforma</p>
            </div>
            <button
              onClick={abrirCrear}
              className="flex items-center gap-2 bg-surface-inverse text-white text-strong font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
            >
              <Plus size={15} />
              Nuevo mandante
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6 space-y-5">

          {/* KPI mini */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total", value: MANDANTES.length, color: "text-ink" },
              { label: "Activos", value: MANDANTES.filter(m => m.activo).length, color: "text-ok-ink" },
              { label: "Enterprise", value: MANDANTES.filter(m => m.plan === "Enterprise").length, color: "text-accion-ink" },
              { label: "Pro", value: MANDANTES.filter(m => m.plan === "Pro").length, color: "text-brand-hover" },
            ].map(k => (
              <div key={k.label} className="bg-surface rounded-xl border border-line px-5 py-4">
                <p className="text-micro font-medium text-ink-muted uppercase tracking-wider">{k.label}</p>
                <p className={cn("text-metric font-semibold mt-1 tabular", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Buscador */}
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input
              type="text"
              placeholder="Buscar mandante o RUT..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-body border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"
            />
          </div>

          {/* Tabla */}
          <div className="bg-surface border border-line rounded-xl overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-line-subtle bg-surface-app/60">
                  <th className="text-left px-5 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">RUT</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Plan</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Contratistas</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Acreditación</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Alta</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtrados.map(m => {
                  const pct = m.contratistas > 0 ? Math.round((m.acreditadas / m.contratistas) * 100) : null
                  const barColor = pct === null ? "bg-line" : pct >= 75 ? "bg-ok-ink" : pct >= 50 ? "bg-accion-line" : "bg-bloqueo-ink"
                  const selected = seleccionado?.id === m.id
                  return (
                    <tr
                      key={m.id}
                      onClick={() => abrirPanel(m)}
                      className={cn("cursor-pointer transition-colors", selected ? "bg-surface-app" : "hover:bg-surface-app/70")}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-surface-sunken text-ink-muted text-[10px] font-semibold flex items-center justify-center shrink-0">
                            {initials(m.nombre)}
                          </div>
                          <span className="font-medium text-ink">{m.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-ink-subtle font-mono text-meta">{m.rut}</td>
                      <td className="px-4 py-4">
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border", planCfg(m.plan).color)}>
                          {m.plan}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-ink-muted text-body">{m.contratistas}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct ?? 0}%` }} />
                          </div>
                          <span className="text-meta text-ink-muted">{pct === null ? "—" : `${pct}%`}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-micro font-medium",
                          m.activo ? "text-ok-ink" : "text-ink-subtle"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", m.activo ? "bg-ok-ink" : "bg-line-strong")} />
                          {m.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-meta text-ink-subtle">{m.fecha_creacion}</td>
                      <td className="px-4 py-4">
                        <ChevronRight size={14} className={cn("text-ink-subtle transition-transform", selected && "rotate-90 text-ink-muted")} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="px-5 py-3 border-t border-line-subtle bg-surface-app/50">
              <p className="text-meta text-ink-subtle">{filtrados.length} mandante{filtrados.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Panel lateral */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Panel de detalle"
 className={cn(
        "fixed right-0 top-0 h-full w-full sm:w-96 bg-surface border-l border-line shadow-xl z-20 transition-transform duration-300",
        panelAbierto ? "translate-x-0" : "translate-x-full"
      )}>
        {creando && <NuevoMandantePanel onClose={() => setCreando(false)} onCreado={refetch} />}
        {seleccionado && <DetalleMandante m={seleccionado} onClose={() => setSeleccionado(null)} />}
      </div>
    </div>
  )
}
