"use client"

import { useState } from "react"
import {
  Plus, Search, ChevronRight, X, Building2,
  Users, CheckCircle2, AlertCircle, Globe,
  Mail, Calendar, ToggleLeft, ToggleRight
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
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
  pilares_activos: number
  fecha_creacion: string
  contacto: string
}

// API type from /api/v1/admin/mandantes
interface ApiMandante {
  id: string; razon_social: string; rut: string; plan: string; activo: boolean
  email_contacto: string | null; sitio_web: string | null; total_contratistas: number
  acreditadas: number; pct_acreditacion: number; fecha_creacion: string
}

function mapMandante(a: ApiMandante): Mandante {
  return {
    id: a.id, nombre: a.razon_social, rut: a.rut,
    email: a.email_contacto ?? "", sitio_web: a.sitio_web ?? "",
    plan: (a.plan as Plan) || "Pro", activo: a.activo,
    contratistas: a.total_contratistas, acreditadas: a.acreditadas,
    pilares_activos: 3, fecha_creacion: a.fecha_creacion, contacto: "",
  }
}

const PLAN_CFG: Record<Plan, { label: string; color: string }> = {
  Enterprise: { label: "Enterprise", color: "bg-amber-50 text-amber-700 border-amber-200" },
  Pro:        { label: "Pro",        color: "bg-blue-50 text-blue-700 border-blue-200" },
  Starter:    { label: "Starter",    color: "bg-slate-100 text-slate-600 border-slate-200" },
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

// ── Formulario nuevo mandante ─────────────────────────────────────────────────

function NuevoMandantePanel({ onClose }: { onClose: () => void }) {
  const [nombre, setNombre] = useState("")
  const [rut, setRut] = useState("")
  const [email, setEmail] = useState("")
  const [plan, setPlan] = useState<Plan>("Pro")
  const [guardado, setGuardado] = useState(false)

  function handleGuardar() {
    if (!nombre || !rut || !email) return
    setGuardado(true)
    setTimeout(() => { setGuardado(false); onClose() }, 1500)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Nuevo mandante</p>
          <p className="text-xs text-slate-400 mt-0.5">Se enviará invitación al email indicado</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Razón social</label>
          <input
            value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Empresa S.A."
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">RUT empresa</label>
          <input
            value={rut} onChange={e => setRut(e.target.value)}
            placeholder="76.123.456-7"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Email administrador</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="admin@empresa.cl"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Plan</label>
          <div className="grid grid-cols-3 gap-2">
            {(["Starter", "Pro", "Enterprise"] as Plan[]).map(p => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={cn(
                  "py-2 rounded-lg border text-sm font-medium transition-colors",
                  plan === p ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
          Al crear el mandante, se envía un email con credenciales temporales y acceso al catálogo de pilares para configurar sus requisitos.
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-100 shrink-0">
        <button
          onClick={handleGuardar}
          disabled={!nombre || !rut || !email}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
            guardado
              ? "bg-emerald-500 text-white"
              : !nombre || !rut || !email
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-slate-900 text-white hover:bg-slate-800"
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
  const pct = Math.round((m.acreditadas / m.contratistas) * 100)
  const barColor = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400"

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
            {initials(m.nombre)}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{m.nombre}</p>
            <p className="text-xs text-slate-400 font-mono">{m.rut}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border", PLAN_CFG[m.plan].color)}>
            {PLAN_CFG[m.plan].label}
          </span>
          <span className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded border",
            m.activo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200"
          )}>
            {m.activo ? "Activo" : "Inactivo"}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Contratistas", value: m.contratistas, icon: Users },
            { label: "Acreditados", value: m.acreditadas, icon: CheckCircle2 },
            { label: "Pilares activos", value: m.pilares_activos, icon: AlertCircle },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
                <Icon size={14} className="text-slate-400 mx-auto mb-1" />
                <p className="text-xl font-semibold text-slate-900">{s.value}</p>
                <p className="text-[10px] text-slate-400">{s.label}</p>
              </div>
            )
          })}
        </div>

        {/* Barra acreditación */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-slate-600">Tasa de acreditación</p>
            <span className="text-xs font-semibold text-slate-700">{pct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
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
                <Icon size={13} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400">{f.label}</p>
                  <p className="text-sm text-slate-800">{f.value}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Acciones */}
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <button className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
            <span>Ver contratistas del mandante</span>
            <ChevronRight size={14} className="text-slate-400" />
          </button>
          <button className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
            <span>Cambiar plan</span>
            <ChevronRight size={14} className="text-slate-400" />
          </button>
          <button className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
            m.activo
              ? "border-red-200 text-red-600 hover:bg-red-50"
              : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
          )}>
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

  const { data: apiMandantes } = useApiData<ApiMandante[]>("/api/v1/admin/mandantes", [])
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
        <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Mandantes</h1>
              <p className="text-sm text-slate-500 mt-0.5">Empresas registradas en la plataforma</p>
            </div>
            <button
              onClick={abrirCrear}
              className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
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
              { label: "Total", value: MANDANTES.length, color: "text-slate-900" },
              { label: "Activos", value: MANDANTES.filter(m => m.activo).length, color: "text-emerald-600" },
              { label: "Enterprise", value: MANDANTES.filter(m => m.plan === "Enterprise").length, color: "text-amber-600" },
              { label: "Pro", value: MANDANTES.filter(m => m.plan === "Pro").length, color: "text-blue-600" },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
                <p className={cn("text-3xl font-semibold mt-1", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Buscador */}
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar mandante o RUT..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>

          {/* Tabla */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">RUT</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contratistas</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acreditación</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Alta</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map(m => {
                  const pct = Math.round((m.acreditadas / m.contratistas) * 100)
                  const barColor = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400"
                  const selected = seleccionado?.id === m.id
                  return (
                    <tr
                      key={m.id}
                      onClick={() => abrirPanel(m)}
                      className={cn("cursor-pointer transition-colors", selected ? "bg-slate-50" : "hover:bg-slate-50/70")}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {initials(m.nombre)}
                          </div>
                          <span className="font-medium text-slate-900">{m.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-400 font-mono text-xs">{m.rut}</td>
                      <td className="px-4 py-4">
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border", PLAN_CFG[m.plan].color)}>
                          {m.plan}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600 text-sm">{m.contratistas}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium",
                          m.activo ? "text-emerald-600" : "text-slate-400"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", m.activo ? "bg-emerald-500" : "bg-slate-300")} />
                          {m.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-400">{m.fecha_creacion}</td>
                      <td className="px-4 py-4">
                        <ChevronRight size={14} className={cn("text-slate-300 transition-transform", selected && "rotate-90 text-slate-500")} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-400">{filtrados.length} mandante{filtrados.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Panel lateral */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-20 transition-transform duration-300",
        panelAbierto ? "translate-x-0" : "translate-x-full"
      )}>
        {creando && <NuevoMandantePanel onClose={() => setCreando(false)} />}
        {seleccionado && <DetalleMandante m={seleccionado} onClose={() => setSeleccionado(null)} />}
      </div>
    </div>
  )
}
