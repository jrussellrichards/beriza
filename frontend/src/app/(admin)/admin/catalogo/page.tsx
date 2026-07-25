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
  blue:    { border: "border-brand-line",    bg: "bg-brand-soft",    dot: "bg-brand-soft0",    text: "text-brand-hover" },
  amber:   { border: "border-accion-line",   bg: "bg-accion-soft",   dot: "bg-accion-soft0",   text: "text-accion-ink" },
  purple:  { border: "border-excepcion-line",  bg: "bg-excepcion-soft",  dot: "bg-excepcion-soft0",  text: "text-excepcion-ink" },
  slate:   { border: "border-line",   bg: "bg-surface-app",   dot: "bg-surface-app0",   text: "text-ink-secondary" },
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
            <span className="text-xs text-ink-muted font-mono">{pilar.codigo}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-ink-muted">{requisitos.length} requisitos</span>
          {open ? <ChevronDown size={15} className="text-ink-subtle" /> : <ChevronRight size={15} className="text-ink-subtle" />}
        </div>
      </button>

      {open && (
        <div className="bg-surface">
          <div className="divide-y divide-slate-50">
            {requisitos.map(req => (
              <div key={req.id} className="px-5 py-3.5 flex items-start gap-3 group hover:bg-surface-app/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-medium text-ink">{req.nombre}</p>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-surface-sunken text-ink-muted border-line">
                      {req.codigo}
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                      req.entidad_tipo === "EMPRESA"
                        ? "bg-surface-sunken text-ink-muted border-line"
                        : "bg-brand-soft text-brand-hover border-brand-line"
                    )}>
                      {req.entidad_tipo === "EMPRESA" ? "Empresa" : "Trabajador"}
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                      req.alcance === "SERVICIO"
                        ? "bg-brand-soft text-brand-hover border-brand-line"
                        : "bg-surface-sunken text-ink-muted border-line"
                    )}>
                      {req.alcance === "SERVICIO" ? "Por servicio" : "Una vez"}
                    </span>
                    {req.max_archivos > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-surface-sunken text-ink-muted border-line">
                        hasta {req.max_archivos} archivos
                      </span>
                    )}
                  </div>
                  {req.descripcion && <p className="text-xs text-ink-subtle">{req.descripcion}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                  <button
                    onClick={() => onEdit(req)}
                    title="Editar requisito"
                    className="p-1.5 rounded-md hover:bg-surface-sunken text-ink-subtle hover:text-ink-muted transition-colors"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => onDelete(req)}
                    title="Eliminar del catálogo"
                    className="p-1.5 rounded-md hover:bg-bloqueo-soft text-ink-subtle hover:text-bloqueo-ink transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-line-subtle">
            <button
              onClick={onAdd}
              className="flex items-center gap-2 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
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
        <div className="px-8 py-6 border-b border-line bg-surface shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-ink">Catálogo global</h1>
              <p className="text-sm text-ink-muted mt-0.5">
                {totalRequisitos} requisitos en {pilares.length} pilares — los mandantes los activan en sus perfiles
              </p>
            </div>
          </div>
          {error && (
            <p className="mt-3 text-sm text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line rounded-lg px-4 py-2">{error}</p>
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
            <div className="py-14 text-center bg-surface rounded-xl border border-line">
              <p className="text-sm text-ink-subtle">Cargando catálogo...</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel lateral */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-surface border-l border-line shadow-xl z-20 transition-transform duration-300",
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
