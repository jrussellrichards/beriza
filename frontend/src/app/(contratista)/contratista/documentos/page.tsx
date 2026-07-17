"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight,
  FileText, History, RefreshCw, Search, Upload,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { SubirDocumentoDialog, type RequisitoSubida } from "@/features/subir-documento/subir-documento-dialog"
import { HistorialDialog } from "@/entities/documento/historial-dialog"
import { getSession } from "@/shared/lib/auth"
import { api } from "@/shared/lib/api"

// ── Tipos (espejo del endpoint de exigencias) ─────────────────────────────────

type EstadoDoc = "APROBADO" | "EN_ANALISIS" | "OBSERVADO" | "ENVIADO" | "FALTA"

interface Exigencia {
  requisito_id: string
  requisito_codigo: string
  requisito_nombre: string
  entidad_tipo: "EMPRESA" | "TRABAJADOR"
  alcance: "ENTIDAD" | "SERVICIO"
  max_archivos: number
  estado: number | null
  fecha_vigencia_hasta: string | null
  mensaje_brecha: string | null
  documento_id: string | null
  trabajador_id: string | null
  trabajador_nombre: string | null
  servicio_id: string | null
  servicio_nombre: string | null
  pilar_codigo: string
  pilar_nombre: string
}

const ESTADO_NUM: Record<number, EstadoDoc> = { 1: "ENVIADO", 2: "EN_ANALISIS", 3: "OBSERVADO", 4: "APROBADO" }
const estadoDe = (e: Exigencia): EstadoDoc => (e.estado ? ESTADO_NUM[e.estado] ?? "FALTA" : "FALTA")

const ESTADO_CFG: Record<EstadoDoc, { label: string; dot: string; text: string; bg: string; border: string }> = {
  APROBADO:    { label: "Aprobado",    dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  EN_ANALISIS: { label: "En análisis", dot: "bg-blue-400",    text: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  OBSERVADO:   { label: "Observado",   dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200" },
  ENVIADO:     { label: "En revisión", dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  FALTA:       { label: "Falta",       dot: "bg-slate-300",   text: "text-slate-500",   bg: "bg-slate-50",   border: "border-slate-200" },
}

const PILAR_COLOR: Record<string, { border: string; bg: string; dot: string; text: string }> = {
  LEGAL:      { border: "border-blue-200",   bg: "bg-blue-50",   dot: "bg-blue-500",   text: "text-blue-700" },
  HSE:        { border: "border-amber-200",  bg: "bg-amber-50",  dot: "bg-amber-500",  text: "text-amber-700" },
  COMPLIANCE: { border: "border-purple-200", bg: "bg-purple-50", dot: "bg-purple-500", text: "text-purple-700" },
}
const PILAR_DEFAULT = { border: "border-slate-200", bg: "bg-slate-50", dot: "bg-slate-500", text: "text-slate-700" }

function formatFecha(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
}

// ── Componentes ───────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoDoc }) {
  const c = ESTADO_CFG[estado] ?? ESTADO_CFG.FALTA
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", c.bg, c.border, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  )
}

function ExigenciaRow({ item, onSubir, onHistorial }: {
  item: Exigencia
  onSubir: (e: Exigencia) => void
  onHistorial: (e: Exigencia) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const estado = estadoDe(item)
  const tieneBrecha = estado === "OBSERVADO" && !!item.mensaje_brecha
  const vence = formatFecha(item.fecha_vigencia_hasta)

  return (
    <div className={cn(
      "rounded-lg border transition-colors",
      tieneBrecha ? "border-red-200 bg-red-50/30" : "border-slate-100 bg-white"
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        <FileText size={14} className="text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-900">{item.requisito_nombre}</p>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">
              {item.requisito_codigo}
            </span>
            {item.trabajador_nombre && (
              <span className="text-[10px] text-slate-500 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                {item.trabajador_nombre}
              </span>
            )}
            {item.servicio_nombre && (
              <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                Servicio: {item.servicio_nombre}
              </span>
            )}
          </div>
          {vence && <p className="text-xs text-slate-400 mt-0.5">Vence: {vence}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <EstadoBadge estado={estado} />
          {(estado === "OBSERVADO" || estado === "FALTA" || estado === "APROBADO") && (
            <button
              onClick={() => onSubir(item)}
              className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <Upload size={12} />
              {estado === "FALTA" ? "Subir" : estado === "APROBADO" ? "Renovar" : "Resubir"}
            </button>
          )}
          {item.documento_id && (
            <button
              onClick={() => onHistorial(item)}
              title="Ver historial del expediente"
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <History size={13} />
            </button>
          )}
          {tieneBrecha && (
            <button
              onClick={() => setExpandido(!expandido)}
              className="p-1.5 rounded-md hover:bg-red-100 text-red-400 transition-colors"
            >
              {expandido ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}
        </div>
      </div>

      {tieneBrecha && expandido && (
        <div className="mx-4 mb-3 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-800 mb-0.5">Motivo de observación</p>
              <p className="text-xs text-red-700">{item.mensaje_brecha}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PilarGrupo({ codigo, nombre, items, busqueda, onSubir, onHistorial }: {
  codigo: string
  nombre: string
  items: Exigencia[]
  busqueda: string
  onSubir: (e: Exigencia) => void
  onHistorial: (e: Exigencia) => void
}) {
  const [open, setOpen] = useState(true)
  const c = PILAR_COLOR[codigo] ?? PILAR_DEFAULT

  const filtrados = items.filter(i =>
    i.requisito_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (i.trabajador_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ?? false) ||
    (i.servicio_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ?? false)
  )
  if (busqueda && filtrados.length === 0) return null

  const aprobados = filtrados.filter(i => estadoDe(i) === "APROBADO").length
  const pendientes = filtrados.length - aprobados
  const deEmpresa = filtrados.filter(i => !i.trabajador_id)
  const deTrabajador = filtrados.filter(i => i.trabajador_id)

  return (
    <div className={cn("rounded-xl border overflow-hidden", c.border)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn("w-full flex items-center gap-3 px-5 py-4 text-left hover:opacity-90 transition-opacity", c.bg)}
      >
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", c.dot)} />
        <p className={cn("text-sm font-bold flex-1 text-left", c.text)}>{nombre}</p>
        <div className="flex items-center gap-3 text-xs shrink-0">
          {aprobados > 0 && (
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 size={11} /> {aprobados} aprobado{aprobados !== 1 ? "s" : ""}
            </span>
          )}
          {pendientes > 0 && (
            <span className="flex items-center gap-1 text-red-500 font-medium">
              <AlertCircle size={11} /> {pendientes} pendiente{pendientes !== 1 ? "s" : ""}
            </span>
          )}
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="bg-white p-4 space-y-4">
          {deEmpresa.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Empresa</p>
              <div className="space-y-1.5">
                {deEmpresa.map((i, idx) => (
                  <ExigenciaRow key={`${i.requisito_id}-${i.servicio_id ?? "e"}-${idx}`} item={i} onSubir={onSubir} onHistorial={onHistorial} />
                ))}
              </div>
            </div>
          )}
          {deTrabajador.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Por trabajador</p>
              <div className="space-y-1.5">
                {deTrabajador.map((i, idx) => (
                  <ExigenciaRow key={`${i.requisito_id}-${i.trabajador_id}-${i.servicio_id ?? "e"}-${idx}`} item={i} onSubir={onSubir} onHistorial={onHistorial} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function DocumentosPage() {
  const [session, setSession] = useState<{ contratista_id: string; mandante_id: string } | null>(null)
  const [exigencias, setExigencias] = useState<Exigencia[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [subirItem, setSubirItem] = useState<Exigencia | null>(null)
  const [historialItem, setHistorialItem] = useState<Exigencia | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoDoc | "TODOS">("TODOS")

  const cargar = useCallback((s?: { contratista_id: string; mandante_id: string } | null) => {
    const sesion = s ?? getSession()
    if (!sesion?.contratista_id || !sesion?.mandante_id) return
    setLoading(true)
    api.get<Exigencia[]>(`/api/v1/acreditacion/${sesion.contratista_id}/mandante/${sesion.mandante_id}/exigencias`)
      .then(setExigencias)
      .catch(() => setExigencias([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const s = getSession()
    if (s) {
      setSession(s)
      cargar(s)
    }
  }, [cargar])

  const kpi = {
    total: exigencias.length,
    aprobados: exigencias.filter(e => estadoDe(e) === "APROBADO").length,
    enRevision: exigencias.filter(e => ["ENVIADO", "EN_ANALISIS"].includes(estadoDe(e))).length,
    observados: exigencias.filter(e => estadoDe(e) === "OBSERVADO").length,
  }

  const visibles = filtroEstado === "TODOS" ? exigencias : exigencias.filter(e => estadoDe(e) === filtroEstado)

  // Agrupar por pilar preservando el orden del backend
  const pilares: { codigo: string; nombre: string; items: Exigencia[] }[] = []
  for (const e of visibles) {
    let g = pilares.find(p => p.codigo === e.pilar_codigo)
    if (!g) {
      g = { codigo: e.pilar_codigo, nombre: e.pilar_nombre, items: [] }
      pilares.push(g)
    }
    g.items.push(e)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Documentos</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Lo que tus servicios activos exigen y el estado de cada expediente
            </p>
          </div>
          <button
            onClick={() => cargar()}
            className="flex items-center gap-2 text-sm text-slate-500 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={13} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-5">

        {/* KPI */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Exigidos", value: kpi.total, color: "text-slate-900" },
            { label: "Aprobados", value: kpi.aprobados, color: "text-emerald-600" },
            { label: "En revisión", value: kpi.enRevision, color: "text-blue-600" },
            { label: "Observados", value: kpi.observados, color: "text-red-600" },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
              <p className={cn("text-3xl font-semibold mt-1", k.color)}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Alerta observados */}
        {kpi.observados > 0 && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                {kpi.observados} documento{kpi.observados !== 1 ? "s" : ""} requiere{kpi.observados === 1 ? "" : "n"} corrección
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                Revisa el motivo de cada observación y resube la versión corregida para avanzar en tu acreditación.
              </p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar documento, trabajador o servicio..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {([
              { value: "TODOS", label: "Todos" },
              { value: "APROBADO", label: "Aprobados" },
              { value: "ENVIADO", label: "En revisión" },
              { value: "OBSERVADO", label: "Observados" },
              { value: "FALTA", label: "Faltan" },
            ] as const).map(f => (
              <button
                key={f.value}
                onClick={() => setFiltroEstado(f.value as EstadoDoc | "TODOS")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  filtroEstado === f.value ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grupos por pilar */}
        <div className="space-y-4">
          {pilares.map(g => (
            <PilarGrupo
              key={g.codigo}
              codigo={g.codigo}
              nombre={g.nombre}
              items={g.items}
              busqueda={busqueda}
              onSubir={setSubirItem}
              onHistorial={setHistorialItem}
            />
          ))}
          {!loading && pilares.length === 0 && (
            <div className="py-14 text-center bg-white rounded-xl border border-slate-200">
              <FileText size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">
                {exigencias.length === 0
                  ? "Aún no tienes servicios activos — no hay documentos exigidos"
                  : "No hay documentos que coincidan con el filtro"}
              </p>
              {exigencias.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  Cuando el mandante cree un servicio para tu empresa, sus exigencias aparecerán aquí.
                </p>
              )}
            </div>
          )}
          {loading && pilares.length === 0 && (
            <div className="py-14 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-sm text-slate-400">Cargando exigencias...</p>
            </div>
          )}
        </div>
      </div>

      {historialItem?.documento_id && (
        <HistorialDialog
          documentoId={historialItem.documento_id}
          titulo={
            historialItem.trabajador_nombre
              ? `${historialItem.requisito_nombre} — ${historialItem.trabajador_nombre}`
              : historialItem.requisito_nombre + (historialItem.servicio_nombre ? ` — ${historialItem.servicio_nombre}` : "")
          }
          onClose={() => setHistorialItem(null)}
        />
      )}

      {session && subirItem && (
        <SubirDocumentoDialog
          open
          onClose={() => setSubirItem(null)}
          onSuccess={() => cargar()}
          requisito={{
            id: subirItem.requisito_id,
            nombre: subirItem.requisito_nombre,
            codigo: subirItem.requisito_codigo,
            alcance: subirItem.alcance,
            max_archivos: subirItem.max_archivos,
          } satisfies RequisitoSubida}
          mandanteId={session.mandante_id}
          empresaId={subirItem.trabajador_id ? undefined : session.contratista_id}
          trabajadorId={subirItem.trabajador_id ?? undefined}
          trabajadorNombre={subirItem.trabajador_nombre ?? undefined}
          servicioFijo={
            subirItem.servicio_id && subirItem.servicio_nombre
              ? { id: subirItem.servicio_id, nombre: subirItem.servicio_nombre }
              : undefined
          }
        />
      )}
    </div>
  )
}
