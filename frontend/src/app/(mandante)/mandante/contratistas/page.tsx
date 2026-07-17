"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle, Briefcase, CheckCircle2, ChevronRight,
  FileText, History, Plus, Search, ShieldCheck, Users, X,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { getSession } from "@/shared/lib/auth"
import { api } from "@/shared/lib/api"
import { InvitarContratistaDialog } from "@/features/invitar-contratista/invitar-contratista-dialog"
import { HistorialDialog } from "@/entities/documento/historial-dialog"
import type { Servicio } from "@/entities/servicio/types"
import type { EstadoGlobal } from "@/shared/types"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Textarea } from "@/shared/ui/textarea"
import { Label } from "@/shared/ui/label"

// ── Tipos (espejo de contratistas-detalle) ────────────────────────────────────

interface DocDetalle {
  requisito_id: string
  requisito_codigo: string
  requisito_nombre: string
  entidad_tipo: "EMPRESA" | "TRABAJADOR"
  pilar_codigo: string
  pilar_nombre: string
  servicio_nombre: string | null
  estado: number | null
  fecha_vigencia_hasta: string | null
  mensaje_brecha: string | null
  documento_id: string | null
}

interface PilarDetalle {
  codigo: string
  nombre: string
  color: string
  cumple: boolean
  documentos: DocDetalle[]
}

interface TrabajadorDetalle {
  id: string
  nombre: string
  rut: string
  cargo: string | null
  cumple: boolean
  documentos: DocDetalle[]
}

interface Contratista {
  id: string
  razon_social: string
  rut: string
  giro: string | null
  estado_acreditacion: EstadoGlobal
  total_trabajadores: number
  pilares: PilarDetalle[]
  trabajadores: TrabajadorDetalle[]
}

type PanelTab = "estado" | "documentos" | "trabajadores" | "servicios"

// ── Config visual ─────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<EstadoGlobal, { label: string; dot: string; text: string; bg: string; border: string }> = {
  ACREDITADA: { label: "Acreditada", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  EN_PROCESO: { label: "En Proceso", dot: "bg-amber-500",  text: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  BLOQUEADA:  { label: "Bloqueada",  dot: "bg-red-500",    text: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  PENDIENTE:  { label: "Pendiente",  dot: "bg-slate-400",  text: "text-slate-600",  bg: "bg-slate-50",  border: "border-slate-200" },
}

// Estados de documento del backend: null=Falta | 1=En revisión | 2=En análisis | 3=Observado | 4=Aprobado
const DOC_CFG: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  "4":    { label: "Aprobado",    dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  "3":    { label: "Observado",   dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200" },
  "2":    { label: "En análisis", dot: "bg-blue-500",    text: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  "1":    { label: "En revisión", dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  "null": { label: "Falta",       dot: "bg-slate-300",   text: "text-slate-500",   bg: "bg-slate-50",   border: "border-slate-200" },
}

const PILAR_COLOR: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

function EstadoBadge({ estado }: { estado: EstadoGlobal }) {
  const c = ESTADO_CFG[estado] ?? ESTADO_CFG.PENDIENTE
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", c.bg, c.border, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  )
}

function DocEstadoBadge({ estado }: { estado: number | null }) {
  const c = DOC_CFG[String(estado)] ?? DOC_CFG["null"]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0", c.bg, c.border, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  )
}

// ── Dialog de excepción (sobre un documento observado) ────────────────────────

function ExcepcionDialog({ doc, onClose, onDone }: {
  doc: DocDetalle
  onClose: () => void
  onDone: () => void
}) {
  const [justificacion, setJustificacion] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!doc.documento_id) return
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("justificacion", justificacion)
      await api.upload(`/api/v1/documentos/${doc.documento_id}/aprobar-excepcion`, form)
      onDone()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al aprobar la excepción")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => !loading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aprobar por excepción</DialogTitle>
          <DialogDescription>
            {doc.requisito_nombre} — quedará aprobado pese a la observación,
            con tu justificación registrada en la bitácora del expediente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {doc.mensaje_brecha && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              Observación actual: {doc.mensaje_brecha}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="just">Justificación</Label>
            <Textarea
              id="just"
              rows={3}
              placeholder="Ej: Se acepta el certificado con 35 días por acuerdo contractual vigente..."
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !justificacion.trim()} className="bg-purple-600 hover:bg-purple-700">
              {loading ? "Aprobando..." : "Aprobar excepción"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Panel detalle ─────────────────────────────────────────────────────────────

function DocRow({ doc, onExcepcion, onVerArchivos }: {
  doc: DocDetalle
  onExcepcion: (d: DocDetalle) => void
  onVerArchivos: (d: DocDetalle) => void
}) {
  return (
    <div className="px-3 py-2 rounded-lg bg-white border border-slate-100">
      <div className="flex items-center gap-2.5">
        <FileText size={13} className="text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-800 truncate">
            {doc.requisito_nombre}
            {doc.servicio_nombre && <span className="text-indigo-500 font-normal"> — {doc.servicio_nombre}</span>}
          </p>
          {doc.fecha_vigencia_hasta && (
            <p className="text-[10px] text-slate-400">Vence: {doc.fecha_vigencia_hasta}</p>
          )}
        </div>
        <DocEstadoBadge estado={doc.estado} />
        {doc.documento_id && (
          <button
            onClick={() => onVerArchivos(doc)}
            title="Ver archivos subidos"
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <History size={13} />
          </button>
        )}
        {doc.estado === 3 && doc.documento_id && (
          <button
            onClick={() => onExcepcion(doc)}
            title="Aprobar por excepción justificada"
            className="text-[10px] font-medium text-purple-700 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-md transition-colors shrink-0"
          >
            Excepción
          </button>
        )}
      </div>
      {doc.estado === 3 && doc.mensaje_brecha && (
        <p className="text-[10px] text-red-600 mt-1 ml-6 flex items-start gap-1">
          <AlertCircle size={10} className="mt-px shrink-0" />
          {doc.mensaje_brecha}
        </p>
      )}
    </div>
  )
}

function ServiciosTab({ contratistaId }: { contratistaId: string }) {
  const [servicios, setServicios] = useState<Servicio[] | null>(null)

  useEffect(() => {
    api.get<Servicio[]>(`/api/v1/servicios/?contratista_id=${contratistaId}`)
      .then(setServicios)
      .catch(() => setServicios([]))
  }, [contratistaId])

  if (servicios === null) return <p className="text-xs text-slate-400">Cargando servicios...</p>
  if (servicios.length === 0) {
    return (
      <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-md px-3 py-2">
        Sin servicios contratados. Crea uno desde la página Servicios para que existan exigencias.
      </p>
    )
  }
  return (
    <div className="space-y-1.5">
      {servicios.map((s) => (
        <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <Briefcase size={13} className="text-slate-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-800 truncate">{s.nombre}</p>
              <p className="text-[10px] text-slate-400">
                {s.codigo_referencia ? `${s.codigo_referencia} · ` : ""}Perfil: {s.perfil_nombre} · {s.trabajadores_asignados} trabajador{s.trabajadores_asignados !== 1 ? "es" : ""}
              </p>
            </div>
          </div>
          <span className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full border",
            s.estado === "ACTIVO" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : s.estado === "SUSPENDIDO" ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-slate-100 text-slate-600 border-slate-200"
          )}>
            {s.estado === "ACTIVO" ? "Activo" : s.estado === "SUSPENDIDO" ? "Suspendido" : "Terminado"}
          </span>
        </div>
      ))}
    </div>
  )
}

function DetailPanel({ c, onClose, onCambio }: {
  c: Contratista
  onClose: () => void
  onCambio: () => void
}) {
  const [tab, setTab] = useState<PanelTab>("estado")
  const [excepcionDoc, setExcepcionDoc] = useState<DocDetalle | null>(null)
  const [historialDoc, setHistorialDoc] = useState<DocDetalle | null>(null)

  const trabajadoresOk = c.trabajadores.filter(t => t.cumple).length
  const docsEmpresa = c.pilares.flatMap(p => p.documentos)
  const docsTrabajadores = c.trabajadores.flatMap(t =>
    t.documentos.map(d => ({ ...d, trabajador: t.nombre }))
  )
  const totalDocs = docsEmpresa.length + docsTrabajadores.length

  const tabs: { id: PanelTab; label: string; count?: number }[] = [
    { id: "estado", label: "Estado" },
    { id: "documentos", label: "Documentos", count: totalDocs },
    { id: "trabajadores", label: "Trabajadores", count: c.trabajadores.length },
    { id: "servicios", label: "Servicios" },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-0 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
              {initials(c.razon_social)}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-tight">{c.razon_social}</p>
              <p className="text-xs text-slate-400 font-mono">{c.rut}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={16} />
          </button>
        </div>
        <EstadoBadge estado={c.estado_acreditacion} />

        <div className="flex gap-0 mt-4 -mb-px overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                  tab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === "estado" && (
          <div className="space-y-3">
            {c.pilares.map(pilar => {
              const brechas = pilar.documentos
                .filter(d => d.estado !== 4)
                .map(d => d.estado === 3 && d.mensaje_brecha
                  ? d.mensaje_brecha
                  : `${d.requisito_nombre}${d.servicio_nombre ? ` (${d.servicio_nombre})` : ""}: ${(DOC_CFG[String(d.estado)] ?? DOC_CFG["null"]).label.toLowerCase()}`)
              return (
                <div key={pilar.codigo} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-slate-800">{pilar.nombre}</p>
                    {pilar.cumple
                      ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 size={12} /> OK</span>
                      : <span className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={12} /> {brechas.length} brecha{brechas.length !== 1 ? "s" : ""}</span>
                    }
                  </div>
                  {brechas.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {brechas.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                          <AlertCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
            {c.pilares.length === 0 && (
              <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-md px-3 py-2">
                Sin servicios activos — no hay requisitos exigibles para esta empresa todavía.
              </p>
            )}
          </div>
        )}

        {tab === "documentos" && (
          <div className="space-y-5">
            {c.pilares.map(pilar => {
              const docsT = docsTrabajadores.filter(d => d.pilar_codigo === pilar.codigo)
              return (
                <div key={pilar.codigo}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", PILAR_COLOR[pilar.color] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                      {pilar.nombre}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {pilar.documentos.length + docsT.length} doc{pilar.documentos.length + docsT.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {pilar.documentos.map((doc, i) => (
                      <DocRow key={`${doc.requisito_id}-${i}`} doc={doc} onExcepcion={setExcepcionDoc} onVerArchivos={setHistorialDoc} />
                    ))}
                    {docsT.length > 0 && (
                      <div className="mt-1 ml-2 border-l-2 border-slate-100 pl-3 space-y-1.5">
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1.5">Por trabajador</p>
                        {docsT.map((doc, i) => (
                          <div key={`${doc.requisito_id}-${doc.trabajador}-${i}`}>
                            <p className="text-[10px] text-slate-400 mb-0.5">{doc.trabajador}</p>
                            <DocRow doc={doc} onExcepcion={setExcepcionDoc} onVerArchivos={setHistorialDoc} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === "trabajadores" && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">
              {trabajadoresOk}/{c.trabajadores.length} trabajadores evaluados cumplen todos los requisitos
            </p>
            {c.trabajadores.map(t => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.nombre}</p>
                  <p className="text-xs text-slate-400 font-mono">{t.rut}{t.cargo ? ` · ${t.cargo}` : ""}</p>
                </div>
                {t.cumple
                  ? <CheckCircle2 size={14} className="text-emerald-500" />
                  : <AlertCircle size={14} className="text-red-400" />
                }
              </div>
            ))}
            {c.trabajadores.length === 0 && (
              <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-md px-3 py-2">
                Sin trabajadores asignados a servicios activos.
              </p>
            )}
          </div>
        )}

        {tab === "servicios" && <ServiciosTab contratistaId={c.id} />}
      </div>

      {excepcionDoc && (
        <ExcepcionDialog
          doc={excepcionDoc}
          onClose={() => setExcepcionDoc(null)}
          onDone={onCambio}
        />
      )}

      {historialDoc?.documento_id && (
        <HistorialDialog
          documentoId={historialDoc.documento_id}
          titulo={
            historialDoc.servicio_nombre
              ? `${historialDoc.requisito_nombre} — ${historialDoc.servicio_nombre}`
              : historialDoc.requisito_nombre
          }
          onClose={() => setHistorialDoc(null)}
        />
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ContratistasPage() {
  const [contratistas, setContratistas] = useState<Contratista[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<EstadoGlobal | "TODOS">("TODOS")
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [dialogInvitar, setDialogInvitar] = useState(false)
  const [mandanteId, setMandanteId] = useState<string | null>(null)
  const [invitado, setInvitado] = useState(false)

  const cargar = useCallback((mid: string) => {
    setLoading(true)
    api.get<Contratista[]>(`/api/v1/mandantes/${mid}/contratistas-detalle`)
      .then((data) => { setContratistas(data); setError(null) })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const s = getSession()
    if (s?.mandante_id) {
      setMandanteId(s.mandante_id)
      cargar(s.mandante_id)
    }
  }, [cargar])

  const seleccionado = contratistas.find(c => c.id === seleccionadoId) ?? null

  const filtrados = contratistas.filter(c => {
    const matchQ = c.razon_social.toLowerCase().includes(busqueda.toLowerCase()) || c.rut.includes(busqueda)
    const matchE = filtro === "TODOS" || c.estado_acreditacion === filtro
    return matchQ && matchE
  })

  // Columnas de pilares derivadas de los datos (no hardcodeadas)
  const pilarColumnas: { codigo: string; nombre: string }[] = []
  for (const c of contratistas) {
    for (const p of c.pilares) {
      if (!pilarColumnas.some(x => x.codigo === p.codigo)) {
        pilarColumnas.push({ codigo: p.codigo, nombre: p.nombre.split("—")[0].split("/")[0].trim() })
      }
    }
  }

  const kpi = {
    acreditadas: contratistas.filter(c => c.estado_acreditacion === "ACREDITADA").length,
    enProceso: contratistas.filter(c => c.estado_acreditacion === "EN_PROCESO").length,
    bloqueadas: contratistas.filter(c => c.estado_acreditacion === "BLOQUEADA").length,
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", seleccionado ? "mr-96" : "")}>

        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Contratistas</h1>
              <p className="text-sm text-slate-500 mt-0.5">Gestiona y monitorea el estado de acreditación</p>
            </div>
            <button
              onClick={() => setDialogInvitar(true)}
              className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus size={15} />
              Invitar contratista
            </button>
          </div>
          {invitado && (
            <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              <p className="text-xs text-emerald-700">Invitación enviada — la empresa aparecerá al activar su cuenta.</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto px-8 py-6 space-y-5">

          {/* KPI */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total", value: contratistas.length, color: "text-slate-900" },
              { label: "Acreditadas", value: kpi.acreditadas, color: "text-emerald-600" },
              { label: "En Proceso", value: kpi.enProceso, color: "text-amber-600" },
              { label: "Bloqueadas", value: kpi.bloqueadas, color: "text-red-600" },
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
                type="text"
                placeholder="Buscar empresa o RUT..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
              {(["TODOS", "ACREDITADA", "EN_PROCESO", "BLOQUEADA", "PENDIENTE"] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setFiltro(e)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    filtro === e ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  {e === "TODOS" ? "Todos" : ESTADO_CFG[e].label + (e === "EN_PROCESO" ? "" : "s")}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 ml-auto">{filtrados.length} de {contratistas.length}</p>
          </div>

          {/* Tabla */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">RUT</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acreditación</th>
                  {pilarColumnas.map(p => (
                    <th key={p.codigo} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{p.nombre}</th>
                  ))}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Users size={12} className="inline" />
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map(c => {
                  const tOk = c.trabajadores.filter(t => t.cumple).length
                  const selected = seleccionadoId === c.id
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSeleccionadoId(selected ? null : c.id)}
                      className={cn("cursor-pointer transition-colors", selected ? "bg-slate-50" : "hover:bg-slate-50/70")}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {initials(c.razon_social)}
                          </div>
                          <span className="font-medium text-slate-900 truncate max-w-[180px]">{c.razon_social}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{c.rut}</td>
                      <td className="px-4 py-3.5"><EstadoBadge estado={c.estado_acreditacion} /></td>
                      {pilarColumnas.map(col => {
                        const p = c.pilares.find(x => x.codigo === col.codigo)
                        return (
                          <td key={col.codigo} className="px-4 py-3.5">
                            {p === undefined
                              ? <span className="text-xs text-slate-300">—</span>
                              : (
                                <span className={cn("inline-flex items-center gap-1 text-xs font-medium", p.cumple ? "text-emerald-700" : "text-red-600")}>
                                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", p.cumple ? "bg-emerald-500" : "bg-red-500")} />
                                  {p.cumple ? "OK" : "Brechas"}
                                </span>
                              )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3.5">
                        <span className={cn("text-xs font-medium", c.trabajadores.length > 0 && tOk === c.trabajadores.length ? "text-emerald-600" : "text-amber-600")}>
                          {tOk}/{c.trabajadores.length}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <ChevronRight size={14} className={cn("text-slate-300 transition-transform", selected && "rotate-90 text-slate-500")} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {loading && filtrados.length === 0 && (
              <div className="py-14 text-center"><p className="text-sm text-slate-400">Cargando contratistas...</p></div>
            )}
            {error && !loading && (
              <div className="py-14 text-center"><p className="text-sm text-red-500">No se pudieron cargar los contratistas: {error}</p></div>
            )}
            {!loading && !error && filtrados.length === 0 && (
              <div className="py-14 text-center"><p className="text-sm text-slate-400">No se encontraron contratistas</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Panel lateral */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-20 transition-transform duration-300",
        seleccionado ? "translate-x-0" : "translate-x-full"
      )}>
        {seleccionado && mandanteId && (
          <DetailPanel
            c={seleccionado}
            onClose={() => setSeleccionadoId(null)}
            onCambio={() => cargar(mandanteId)}
          />
        )}
      </div>

      {dialogInvitar && mandanteId && (
        <InvitarContratistaDialog
          mandanteId={mandanteId}
          onClose={() => setDialogInvitar(false)}
          onSuccess={() => {
            setInvitado(true)
            setTimeout(() => setInvitado(false), 5000)
            cargar(mandanteId)
          }}
        />
      )}
    </div>
  )
}
