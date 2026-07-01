"use client"

import { useEffect, useState } from "react"
import {
  Upload, FileText, CheckCircle2, Clock,
  AlertCircle, XCircle, ChevronDown, ChevronRight,
  Download, RefreshCw, Search
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { SubirDocumentoDialog } from "@/features/subir-documento/subir-documento-dialog"
import { getSession } from "@/shared/lib/auth"
import { useApiData } from "@/shared/lib/use-api-data"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type EstadoDoc = "APROBADO" | "EN_ANALISIS" | "OBSERVADO" | "ENVIADO"

interface Documento {
  id: string
  nombre: string
  codigo: string
  entidad: "EMPRESA" | "TRABAJADOR"
  trabajador?: string
  estado: EstadoDoc
  fecha_subida: string
  fecha_vence: string | null
  mensaje_brecha?: string
}

interface GrupoDocumentos {
  pilar: string
  color: string
  documentos: Documento[]
}

// ── API types ─────────────────────────────────────────────────────────────────

interface ApiDocEmpresa {
  id: string | null; requisito_id: string; requisito_codigo: string; requisito_nombre: string
  estado: number | null; fecha_vigencia_hasta: string | null; mensaje_brecha: string | null
}
interface ApiDocTrabajador {
  trabajador_id: string; trabajador_nombre: string; trabajador_rut: string
  documentos: ApiDocEmpresa[]
}
interface ApiGrupo {
  pilar_codigo: string; pilar_nombre: string; color: string
  documentos_empresa: ApiDocEmpresa[]
  documentos_trabajadores: ApiDocTrabajador[]
}

const ESTADO_NUM: Record<number, EstadoDoc> = { 1: "ENVIADO", 2: "EN_ANALISIS", 3: "OBSERVADO", 4: "APROBADO" }

function mapEstado(n: number | null): EstadoDoc {
  return n ? (ESTADO_NUM[n] ?? "ENVIADO") : "ENVIADO"
}

function formatFecha(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
}

function mapGrupos(api: ApiGrupo[]): GrupoDocumentos[] {
  return api.map(g => {
    const docsEmpresa: Documento[] = g.documentos_empresa.map(d => ({
      id: d.id ?? d.requisito_id,
      nombre: d.requisito_nombre,
      codigo: d.requisito_codigo,
      entidad: "EMPRESA",
      estado: mapEstado(d.estado),
      fecha_subida: "",
      fecha_vence: formatFecha(d.fecha_vigencia_hasta) || null,
      mensaje_brecha: d.mensaje_brecha ?? undefined,
    }))
    const docsTrabajador: Documento[] = g.documentos_trabajadores.flatMap(t =>
      t.documentos.map(d => ({
        id: d.id ?? `${t.trabajador_id}-${d.requisito_id}`,
        nombre: d.requisito_nombre,
        codigo: d.requisito_codigo,
        entidad: "TRABAJADOR",
        trabajador: t.trabajador_nombre,
        estado: mapEstado(d.estado),
        fecha_subida: "",
        fecha_vence: formatFecha(d.fecha_vigencia_hasta) || null,
        mensaje_brecha: d.mensaje_brecha ?? undefined,
      }))
    )
    return {
      pilar: g.pilar_nombre,
      color: g.color,
      documentos: [...docsEmpresa, ...docsTrabajador],
    }
  })
}

// ── Config visual ─────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<EstadoDoc, {
  label: string; icon: React.ElementType
  dot: string; text: string; bg: string; border: string
}> = {
  APROBADO:    { label: "Aprobado",     icon: CheckCircle2, dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  EN_ANALISIS: { label: "En análisis",  icon: Clock,        dot: "bg-blue-400",    text: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200"   },
  OBSERVADO:   { label: "Observado",    icon: AlertCircle,  dot: "bg-red-500",     text: "text-red-700",    bg: "bg-red-50",     border: "border-red-200"    },
  ENVIADO:     { label: "Enviado",      icon: Clock,        dot: "bg-slate-400",   text: "text-slate-600",  bg: "bg-slate-100",  border: "border-slate-200"  },
}

const PILAR_COLOR: Record<string, { border: string; bg: string; dot: string; text: string }> = {
  blue:   { border: "border-blue-200",   bg: "bg-blue-50",   dot: "bg-blue-500",   text: "text-blue-700"   },
  amber:  { border: "border-amber-200",  bg: "bg-amber-50",  dot: "bg-amber-500",  text: "text-amber-700"  },
  purple: { border: "border-purple-200", bg: "bg-purple-50", dot: "bg-purple-500", text: "text-purple-700" },
}

// ── Componentes ───────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoDoc }) {
  const c = ESTADO_CFG[estado]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", c.bg, c.border, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  )
}

function DocRow({
  doc, onSubir,
}: {
  doc: Documento
  onSubir: (doc: Documento) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const tieneBrecha = !!doc.mensaje_brecha

  return (
    <div className={cn(
      "rounded-lg border transition-colors",
      tieneBrecha ? "border-red-200 bg-red-50/30" : "border-slate-100 bg-white"
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        <FileText size={14} className="text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-900">{doc.nombre}</p>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">
              {doc.codigo}
            </span>
            {doc.trabajador && (
              <span className="text-[10px] text-slate-500 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                {doc.trabajador}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-400">Subido: {doc.fecha_subida}</span>
            {doc.fecha_vence && (
              <span className="text-xs text-slate-400">Vence: {doc.fecha_vence}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <EstadoBadge estado={doc.estado} />
          {doc.estado === "APROBADO" && (
            <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <Download size={13} />
            </button>
          )}
          {(doc.estado === "OBSERVADO" || doc.estado === "ENVIADO") && (
            <button
              onClick={() => onSubir(doc)}
              className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <Upload size={12} />
              Resubir
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
              <p className="text-xs text-red-700">{doc.mensaje_brecha}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GrupoSection({ grupo, busqueda, onSubir }: {
  grupo: GrupoDocumentos
  busqueda: string
  onSubir: (doc: Documento) => void
}) {
  const [open, setOpen] = useState(true)
  const c = PILAR_COLOR[grupo.color]
  const docs = grupo.documentos.filter(d =>
    d.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (d.trabajador?.toLowerCase().includes(busqueda.toLowerCase()) ?? false)
  )
  if (busqueda && docs.length === 0) return null

  const porEstado = {
    aprobados: docs.filter(d => d.estado === "APROBADO").length,
    pendientes: docs.filter(d => d.estado !== "APROBADO").length,
  }

  const docsEmpresa = docs.filter(d => d.entidad === "EMPRESA")
  const docsTrabajador = docs.filter(d => d.entidad === "TRABAJADOR")

  return (
    <div className={cn("rounded-xl border overflow-hidden", c.border)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn("w-full flex items-center gap-3 px-5 py-4 text-left hover:opacity-90 transition-opacity", c.bg)}
      >
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", c.dot)} />
        <p className={cn("text-sm font-bold flex-1 text-left", c.text)}>{grupo.pilar}</p>
        <div className="flex items-center gap-3 text-xs shrink-0">
          {porEstado.aprobados > 0 && (
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 size={11} /> {porEstado.aprobados} aprobado{porEstado.aprobados !== 1 ? "s" : ""}
            </span>
          )}
          {porEstado.pendientes > 0 && (
            <span className="flex items-center gap-1 text-red-500 font-medium">
              <AlertCircle size={11} /> {porEstado.pendientes} pendiente{porEstado.pendientes !== 1 ? "s" : ""}
            </span>
          )}
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="bg-white p-4 space-y-4">
          {docsEmpresa.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Empresa</p>
              <div className="space-y-1.5">
                {docsEmpresa.map(d => <DocRow key={d.id} doc={d} onSubir={onSubir} />)}
              </div>
            </div>
          )}

          {docsTrabajador.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Por trabajador</p>
              <div className="space-y-1.5">
                {docsTrabajador.map(d => <DocRow key={d.id} doc={d} onSubir={onSubir} />)}
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
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [docSeleccionado, setDocSeleccionado] = useState<Documento | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoDoc | "TODOS">("TODOS")

  useEffect(() => {
    const s = getSession()
    if (s) {
      setSession(s)
      if (s.contratista_id && s.mandante_id) {
        setEndpoint(`/api/v1/documentos/empresa/${s.contratista_id}/mandante/${s.mandante_id}/agrupados`)
      }
    }
  }, [])

  const { data: apiGrupos } = useApiData<ApiGrupo[]>(endpoint, [])
  const GRUPOS = mapGrupos(apiGrupos)

  function handleSubir(doc?: Documento) {
    setDocSeleccionado(doc ?? null)
    setDialogOpen(true)
  }

  const todosLosDocs = GRUPOS.flatMap(g => g.documentos)
  const docsObservados = todosLosDocs.filter(d => d.estado === "OBSERVADO").length
  const docsAprobados = todosLosDocs.filter(d => d.estado === "APROBADO").length
  const docsEnAnalisis = todosLosDocs.filter(d => d.estado === "EN_ANALISIS" || d.estado === "ENVIADO").length

  const gruposFiltrados = GRUPOS.map(g => ({
    ...g,
    documentos: filtroEstado === "TODOS"
      ? g.documentos
      : g.documentos.filter(d => d.estado === filtroEstado),
  })).filter(g => g.documentos.length > 0)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Documentos</h1>
            <p className="text-sm text-slate-500 mt-0.5">Historial de documentos enviados al mandante</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 text-sm text-slate-500 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
              <RefreshCw size={13} />
              Actualizar
            </button>
            <button
              onClick={() => handleSubir()}
              className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Upload size={14} />
              Subir documento
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-5">

        {/* KPI mini */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total documentos", value: todosLosDocs.length, color: "text-slate-900" },
            { label: "Aprobados", value: docsAprobados, color: "text-emerald-600" },
            { label: "En revisión", value: docsEnAnalisis, color: "text-blue-600" },
            { label: "Observados", value: docsObservados, color: "text-red-600" },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
              <p className={cn("text-3xl font-semibold mt-1", k.color)}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Alerta observados */}
        {docsObservados > 0 && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                {docsObservados} documento{docsObservados !== 1 ? "s" : ""} requiere{docsObservados === 1 ? "" : "n"} corrección
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                Revisa el motivo de cada observación y resubela corregida para avanzar en tu acreditación.
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
              placeholder="Buscar documento o trabajador..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {([
              { value: "TODOS", label: "Todos" },
              { value: "APROBADO", label: "Aprobados" },
              { value: "EN_ANALISIS", label: "En análisis" },
              { value: "OBSERVADO", label: "Observados" },
              { value: "ENVIADO", label: "Enviados" },
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
          {gruposFiltrados.map(g => (
            <GrupoSection key={g.pilar} grupo={g} busqueda={busqueda} onSubir={handleSubir} />
          ))}
          {gruposFiltrados.length === 0 && (
            <div className="py-14 text-center bg-white rounded-xl border border-slate-200">
              <FileText size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No hay documentos que coincidan con el filtro</p>
            </div>
          )}
        </div>

      </div>

      {session && (
        <SubirDocumentoDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setDocSeleccionado(null) }}
          onSuccess={() => {}}
          requisitoId=""
          requisitoNombre={docSeleccionado?.nombre ?? "Documento"}
          entidadTipo="empresa"
          entidadId={session.contratista_id}
          mandanteId={session.mandante_id}
        />
      )}
    </div>
  )
}
