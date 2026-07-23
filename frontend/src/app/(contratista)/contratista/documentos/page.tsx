"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight,
  FileText, RefreshCw, Search,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { SubirDocumentoDialog, type RequisitoSubida } from "@/features/subir-documento/subir-documento-dialog"
import { HistorialDialog } from "@/entities/documento/historial-dialog"
import { type Exigencia, type EstadoDoc, estadoDe, PILAR_COLOR, PILAR_DEFAULT } from "@/entities/documento/exigencia"
import { ExigenciaRow } from "@/entities/documento/exigencia-row"
import { getSession } from "@/shared/lib/auth"
import { api } from "@/shared/lib/api"

// ── Componentes ───────────────────────────────────────────────────────────────

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
