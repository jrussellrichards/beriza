"use client"

import { useState, useEffect } from "react"
import {
  Plus, ChevronDown, ChevronRight, Save,
  CheckCircle2, Trash2, Edit2, X, Lock
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useApiData } from "@/shared/lib/use-api-data"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Requisito {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  entidad: "EMPRESA" | "TRABAJADOR"
}

interface Pilar {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  color: "blue" | "amber" | "purple" | "emerald" | "rose"
  requisitos: Requisito[]
  mandantes_usando: number
}

interface ApiRequisito {
  id: string; codigo: string; nombre: string; entidad_tipo: string
}
interface ApiSubpilar {
  id: string; codigo: string; nombre: string; requisitos: ApiRequisito[]
}
interface ApiPilar {
  id: string; codigo: string; nombre: string; orden: number; color: string
  subpilares: ApiSubpilar[]
}

function mapApiPilares(api: ApiPilar[]): Pilar[] {
  return api.map(p => ({
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    descripcion: "",
    color: (p.color as Pilar["color"]) || "blue",
    mandantes_usando: 0,
    requisitos: p.subpilares.flatMap(sp =>
      sp.requisitos.map(r => ({
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        descripcion: "",
        entidad: r.entidad_tipo as "EMPRESA" | "TRABAJADOR",
      }))
    ),
  }))
}

const COLOR_MAP: Record<string, { border: string; bg: string; dot: string; text: string; badge: string }> = {
  blue:    { border: "border-blue-200",    bg: "bg-blue-50",    dot: "bg-blue-500",    text: "text-blue-700",    badge: "bg-blue-50 text-blue-700 border-blue-200"    },
  amber:   { border: "border-amber-200",   bg: "bg-amber-50",   dot: "bg-amber-500",   text: "text-amber-700",   badge: "bg-amber-50 text-amber-700 border-amber-200"   },
  purple:  { border: "border-purple-200",  bg: "bg-purple-50",  dot: "bg-purple-500",  text: "text-purple-700",  badge: "bg-purple-50 text-purple-700 border-purple-200"  },
  emerald: { border: "border-emerald-200", bg: "bg-emerald-50", dot: "bg-emerald-500", text: "text-emerald-700", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rose:    { border: "border-rose-200",    bg: "bg-rose-50",    dot: "bg-rose-500",    text: "text-rose-700",    badge: "bg-rose-50 text-rose-700 border-rose-200"    },
}

// ── Panel nuevo requisito ─────────────────────────────────────────────────────

function NuevoRequisitoPanel({
  pilarNombre, onClose, onGuardar,
}: {
  pilarNombre: string
  onClose: () => void
  onGuardar: (req: Omit<Requisito, "id">) => void
}) {
  const [codigo, setCodigo] = useState("")
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [entidad, setEntidad] = useState<"EMPRESA" | "TRABAJADOR">("EMPRESA")

  function handleGuardar() {
    if (!codigo || !nombre) return
    onGuardar({ codigo: codigo.toUpperCase().replace(/\s/g, "_"), nombre, descripcion, entidad })
    onClose()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Nuevo requisito</p>
          <p className="text-xs text-slate-400 mt-0.5">Pilar: {pilarNombre}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Código</label>
          <input
            value={codigo} onChange={e => setCodigo(e.target.value)}
            placeholder="CERT_SEGURIDAD"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
          <p className="text-[10px] text-slate-400">Identificador único. Se convierte a mayúsculas automáticamente.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Nombre del requisito</label>
          <input
            value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Certificado de seguridad"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Descripción</label>
          <textarea
            value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="Qué debe contener este documento y cuándo aplica..."
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Entidad que lo presenta</label>
          <div className="grid grid-cols-2 gap-2">
            {(["EMPRESA", "TRABAJADOR"] as const).map(e => (
              <button
                key={e}
                onClick={() => setEntidad(e)}
                className={cn(
                  "py-2 rounded-lg border text-sm font-medium transition-colors",
                  entidad === e ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                {e === "EMPRESA" ? "Empresa" : "Trabajador"}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 flex items-start gap-2">
          <Lock size={11} className="mt-0.5 shrink-0" />
          Este requisito quedará disponible en el catálogo global. Cada mandante decide si lo activa y con qué parámetros.
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-100 shrink-0">
        <button
          onClick={handleGuardar}
          disabled={!codigo || !nombre}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
            !codigo || !nombre
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-slate-900 text-white hover:bg-slate-800"
          )}
        >
          Agregar al catálogo
        </button>
      </div>
    </div>
  )
}

// ── Componente pilar ──────────────────────────────────────────────────────────

function PilarSection({
  pilar, onAddRequisito, onDeleteRequisito,
}: {
  pilar: Pilar
  onAddRequisito: (pilarId: string) => void
  onDeleteRequisito: (pilarId: string, reqId: string) => void
}) {
  const [open, setOpen] = useState(true)
  const c = COLOR_MAP[pilar.color]

  return (
    <div className={cn("rounded-xl border overflow-hidden", c.border)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn("w-full flex items-center gap-4 px-5 py-4 text-left hover:opacity-90 transition-opacity", c.bg)}
      >
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", c.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <p className={cn("text-sm font-bold", c.text)}>{pilar.nombre}</p>
            <span className="text-xs text-slate-500 font-mono">{pilar.codigo}</span>
            <span className="text-xs text-slate-400">{pilar.descripcion}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500">{pilar.requisitos.length} requisitos</span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", c.badge)}>
            {pilar.mandantes_usando} mandante{pilar.mandantes_usando !== 1 ? "s" : ""}
          </span>
          {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="bg-white">
          <div className="divide-y divide-slate-50">
            {pilar.requisitos.map(req => (
              <div key={req.id} className="px-5 py-3.5 flex items-start gap-3 group hover:bg-slate-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-medium text-slate-900">{req.nombre}</p>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">
                      {req.codigo}
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                      req.entidad === "EMPRESA"
                        ? "bg-slate-100 text-slate-500 border-slate-200"
                        : "bg-indigo-50 text-indigo-600 border-indigo-200"
                    )}>
                      {req.entidad === "EMPRESA" ? "Empresa" : "Trabajador"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{req.descripcion}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                  <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => onDeleteRequisito(pilar.id, req.id)}
                    className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-slate-100">
            <button
              onClick={() => onAddRequisito(pilar.id)}
              className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              <Plus size={13} />
              Agregar requisito a {pilar.nombre}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function CatalogoPage() {
  const { data: apiPilares } = useApiData<ApiPilar[]>("/api/v1/pilares/", [])
  const [pilares, setPilares] = useState<Pilar[]>([])
  const [panelPilarId, setPanelPilarId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (apiPilares.length > 0) setPilares(mapApiPilares(apiPilares))
  }, [apiPilares])

  const totalRequisitos = pilares.flatMap(p => p.requisitos).length
  const pilarActivo = pilares.find(p => p.id === panelPilarId)

  function handleAddRequisito(pilarId: string) {
    setPanelPilarId(pilarId)
  }

  function handleGuardarRequisito(pilarId: string, req: Omit<Requisito, "id">) {
    setPilares(prev => prev.map(p =>
      p.id !== pilarId ? p : {
        ...p,
        requisitos: [...p.requisitos, { ...req, id: `r${Date.now()}` }]
      }
    ))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleDeleteRequisito(pilarId: string, reqId: string) {
    setPilares(prev => prev.map(p =>
      p.id !== pilarId ? p : { ...p, requisitos: p.requisitos.filter(r => r.id !== reqId) }
    ))
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", panelPilarId ? "mr-96" : "")}>

        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Catálogo de pilares</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {pilares.length} pilares · {totalRequisitos} requisitos en el catálogo global
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                <Lock size={12} className="text-slate-400" />
                Solo BERISA Admin puede modificar este catálogo
              </div>
              {saved && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 size={13} />
                  Guardado
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6 space-y-4">

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5 flex items-start gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-800 mb-0.5">Catálogo global de pilares y requisitos</p>
              <p className="text-xs text-blue-700">
                Este es el catálogo maestro. Los mandantes seleccionan de aquí qué pilares y requisitos exigen a sus contratistas,
                y configuran los parámetros (vigencia, umbrales, obligatoriedad) en su propio panel de Requisitos.
              </p>
            </div>
          </div>

          {/* Pilares */}
          {pilares.map(pilar => (
            <PilarSection
              key={pilar.id}
              pilar={pilar}
              onAddRequisito={handleAddRequisito}
              onDeleteRequisito={handleDeleteRequisito}
            />
          ))}

        </div>
      </div>

      {/* Panel lateral */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-20 transition-transform duration-300",
        panelPilarId ? "translate-x-0" : "translate-x-full"
      )}>
        {pilarActivo && (
          <NuevoRequisitoPanel
            pilarNombre={pilarActivo.nombre}
            onClose={() => setPanelPilarId(null)}
            onGuardar={req => handleGuardarRequisito(pilarActivo.id, req)}
          />
        )}
      </div>
    </div>
  )
}
