"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Plus, ChevronDown, ChevronRight, Trash2, Edit2,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { RequisitoPanel, type RequisitoCatalogo } from "@/features/catalogo-requisitos/requisito-panel"

// ── Tipos (espejo de /api/v1/pilares/) ────────────────────────────────────────

type Requisito = RequisitoCatalogo & { es_propio: boolean }

interface ApiSubpilar {
  id: string; codigo: string; nombre: string; requisitos: Requisito[]
}

interface Pilar {
  id: string
  codigo: string
  nombre: string
  orden: number
  color: string
  subpilares: ApiSubpilar[]
}

const COLOR_MAP: Record<string, { border: string; bg: string; dot: string; text: string }> = {
  blue:    { border: "border-blue-200",    bg: "bg-blue-50",    dot: "bg-blue-500",    text: "text-blue-700" },
  amber:   { border: "border-amber-200",   bg: "bg-amber-50",   dot: "bg-amber-500",   text: "text-amber-700" },
  purple:  { border: "border-purple-200",  bg: "bg-purple-50",  dot: "bg-purple-500",  text: "text-purple-700" },
  slate:   { border: "border-slate-200",   bg: "bg-slate-50",   dot: "bg-slate-500",   text: "text-slate-700" },
}

// ── Componente pilar ──────────────────────────────────────────────────────────

function PilarSection({ pilar, onAdd, onEdit, onDelete }: {
  pilar: Pilar
  onAdd: () => void
  onEdit: (req: Requisito) => void
  onDelete: (req: Requisito) => void
}) {
  const [open, setOpen] = useState(true)
  const c = COLOR_MAP[pilar.color] ?? COLOR_MAP.slate
  const requisitos = pilar.subpilares.flatMap(sp => sp.requisitos)

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
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500">{requisitos.length} requisitos</span>
          {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="bg-white">
          <div className="divide-y divide-slate-50">
            {requisitos.map(req => (
              <div key={req.id} className="px-5 py-3.5 flex items-start gap-3 group hover:bg-slate-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-medium text-slate-900">{req.nombre}</p>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">
                      {req.codigo}
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                      req.entidad_tipo === "EMPRESA"
                        ? "bg-slate-100 text-slate-500 border-slate-200"
                        : "bg-indigo-50 text-indigo-600 border-indigo-200"
                    )}>
                      {req.entidad_tipo === "EMPRESA" ? "Empresa" : "Trabajador"}
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                      req.alcance === "SERVICIO"
                        ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    )}>
                      {req.alcance === "SERVICIO" ? "Por servicio" : "Una vez"}
                    </span>
                    {req.max_archivos > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-slate-100 text-slate-500 border-slate-200">
                        hasta {req.max_archivos} archivos
                      </span>
                    )}
                  </div>
                  {req.descripcion && <p className="text-xs text-slate-400">{req.descripcion}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                  <button
                    onClick={() => onEdit(req)}
                    title="Editar requisito"
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => onDelete(req)}
                    title="Eliminar del catálogo"
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
              onClick={onAdd}
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
  const [pilares, setPilares] = useState<Pilar[]>([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<{ pilar: Pilar; requisito: Requisito | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    setLoading(true)
    api.get<Pilar[]>("/api/v1/pilares/")
      .then(setPilares)
      .catch(() => setPilares([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const totalRequisitos = pilares.flatMap(p => p.subpilares.flatMap(sp => sp.requisitos)).length

  async function handleDelete(req: Requisito) {
    setError(null)
    if (!window.confirm(`¿Eliminar "${req.nombre}" del catálogo global?`)) return
    try {
      await api.delete(`/api/v1/pilares/requisitos/${req.id}`)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar")
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", panel ? "mr-96" : "")}>
        <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Catálogo global</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {totalRequisitos} requisitos en {pilares.length} pilares — los mandantes los activan en sus perfiles
              </p>
            </div>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
          )}
        </div>

        <div className="flex-1 overflow-auto px-8 py-6 space-y-4">
          {pilares.map(pilar => (
            <PilarSection
              key={pilar.id}
              pilar={pilar}
              onAdd={() => setPanel({ pilar, requisito: null })}
              onEdit={(req) => setPanel({ pilar, requisito: req })}
              onDelete={handleDelete}
            />
          ))}
          {loading && pilares.length === 0 && (
            <div className="py-14 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-sm text-slate-400">Cargando catálogo...</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel lateral */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-20 transition-transform duration-300",
        panel ? "translate-x-0" : "translate-x-full"
      )}>
        {panel && (
          <RequisitoPanel
            pilar={panel.pilar}
            requisito={panel.requisito}
            contexto="global"
            onClose={() => setPanel(null)}
            onDone={cargar}
          />
        )}
      </div>
    </div>
  )
}
