"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Briefcase, ChevronDown, ChevronRight, CheckCircle2,
  Circle, Layers, Lock, Plus, Save, Star, Trash2,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { getSession } from "@/shared/lib/auth"
import type { Perfil } from "@/entities/servicio/types"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { RequisitoPanel, type RequisitoCatalogo } from "@/features/catalogo-requisitos/requisito-panel"

// ── Tipos (espejo del backend) ────────────────────────────────────────────────

interface Requisito {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  entidad: "EMPRESA" | "TRABAJADOR"
  alcance: "ENTIDAD" | "SERVICIO"
  max_archivos: number
  es_obligatorio: boolean
  vigencia_max_dias: number
  umbral_deuda_max: number | null
  es_propio: boolean
}

interface Pilar {
  id: string
  codigo: string
  nombre: string
  color: string
  requisitos: Requisito[]
}

interface ConfigPerfil {
  perfil: { id: string; nombre: string; descripcion: string | null }
  pilares: Pilar[]
}

const COLOR_MAP: Record<string, { border: string; bg: string; dot: string; text: string; badge: string }> = {
  blue:   { border: "border-blue-200",   bg: "bg-blue-50",   dot: "bg-blue-500",   text: "text-blue-700",   badge: "bg-blue-50 text-blue-700 border-blue-200" },
  amber:  { border: "border-amber-200",  bg: "bg-amber-50",  dot: "bg-amber-500",  text: "text-amber-700",  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  purple: { border: "border-purple-200", bg: "bg-purple-50", dot: "bg-purple-500", text: "text-purple-700", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  slate:  { border: "border-slate-200",  bg: "bg-slate-50",  dot: "bg-slate-500",  text: "text-slate-700",  badge: "bg-slate-100 text-slate-600 border-slate-200" },
}

// ── Crear perfil ──────────────────────────────────────────────────────────────

function CrearPerfilDialog({ mandanteId, onClose, onCreado }: {
  mandanteId: string
  onClose: () => void
  onCreado: (perfil: Perfil) => void
}) {
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const perfil = await api.post<Perfil>(`/api/v1/mandantes/${mandanteId}/perfiles`, {
        nombre,
        descripcion: descripcion || null,
      })
      onCreado(perfil)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear perfil")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => !loading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo perfil de exigencias</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              placeholder="Obras civiles, Transporte, Servicios eléctricos..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Descripción (opcional)</Label>
            <Input
              id="desc"
              placeholder="Exigencias para contratos de obras civiles"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-3 py-2">
            El perfil parte sin requisitos exigidos — actívalos después de crearlo.
            Cada servicio que crees podrá usar este perfil.
          </p>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !nombre.trim()}>
              {loading ? "Creando..." : "Crear perfil"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Fila de requisito ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-slate-900" : "bg-slate-200"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  )
}

function RequisitoRow({ req, color, dirty, onChange, onEdit, onDelete }: {
  req: Requisito
  color: string
  dirty: boolean
  onChange: (id: string, cambios: Partial<Requisito>) => void
  onEdit: (req: Requisito) => void
  onDelete: (req: Requisito) => void
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.slate

  return (
    <div className={cn(
      "rounded-lg border p-4 transition-colors group",
      req.es_obligatorio ? "bg-white border-slate-200" : "bg-slate-50/60 border-slate-100",
      dirty && "border-amber-300"
    )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Toggle
            checked={req.es_obligatorio}
            onChange={(v) => onChange(req.id, { es_obligatorio: v })}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className={cn("text-sm font-semibold", req.es_obligatorio ? "text-slate-900" : "text-slate-400")}>
              {req.nombre}
            </p>
            <span className={cn(
              "text-[10px] font-mono px-1.5 py-0.5 rounded border",
              req.es_obligatorio ? c.badge : "bg-slate-100 text-slate-400 border-slate-200"
            )}>
              {req.codigo}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-slate-100 text-slate-500 border-slate-200">
              {req.entidad === "EMPRESA" ? "Empresa" : "Trabajador"}
            </span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded border font-medium",
              req.alcance === "SERVICIO"
                ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            )}>
              {req.alcance === "SERVICIO" ? "Por cada servicio" : "Se acredita una vez"}
            </span>
            {req.es_propio && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-violet-50 text-violet-600 border-violet-200 flex items-center gap-1">
                <Star size={9} /> Propio
              </span>
            )}
            {dirty && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-amber-50 text-amber-700 border-amber-200">
                Sin guardar
              </span>
            )}
          </div>

          {req.es_obligatorio && (
            <div className="flex items-center gap-4 flex-wrap mt-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 whitespace-nowrap">Vigencia máx. (días)</label>
                <input
                  type="number"
                  min={1}
                  value={req.vigencia_max_dias}
                  onChange={(e) => onChange(req.id, { vigencia_max_dias: Number(e.target.value) })}
                  className="w-20 text-xs border border-slate-200 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              {req.codigo.startsWith("F30") && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 whitespace-nowrap">Deuda máx. ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={req.umbral_deuda_max ?? 0}
                    onChange={(e) => onChange(req.id, { umbral_deuda_max: Number(e.target.value) })}
                    className="w-28 text-xs border border-slate-200 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-start gap-1.5 mt-0.5 shrink-0">
          {req.es_propio && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(req)}
                title="Editar requisito propio"
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Layers size={11} />
              </button>
              <button
                onClick={() => onDelete(req)}
                title="Eliminar requisito propio"
                className="p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
          {req.es_obligatorio
            ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
            : <Circle size={15} className="text-slate-300 shrink-0" />
          }
        </div>
      </div>
    </div>
  )
}

function PilarSection({ pilar, dirties, onChange, onEditRequisito, onDeleteRequisito, onCrearPropio }: {
  pilar: Pilar
  dirties: Set<string>
  onChange: (reqId: string, cambios: Partial<Requisito>) => void
  onEditRequisito: (req: Requisito) => void
  onDeleteRequisito: (req: Requisito) => void
  onCrearPropio: () => void
}) {
  const [open, setOpen] = useState(true)
  const c = COLOR_MAP[pilar.color] ?? COLOR_MAP.slate
  const obligatorios = pilar.requisitos.filter(r => r.es_obligatorio).length

  return (
    <div className={cn("rounded-xl border overflow-hidden", c.border)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn("w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:opacity-90", c.bg)}
      >
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", c.dot)} />
        <p className={cn("text-sm font-bold flex-1", c.text)}>{pilar.nombre}</p>
        <span className="text-xs text-slate-500">{obligatorios}/{pilar.requisitos.length} exigidos</span>
        {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
      </button>

      {open && (
        <div className="bg-white">
          <div className="p-4 space-y-2">
            {pilar.requisitos.map(req => (
              <RequisitoRow
                key={req.id}
                req={req}
                color={pilar.color}
                dirty={dirties.has(req.id)}
                onChange={onChange}
                onEdit={onEditRequisito}
                onDelete={onDeleteRequisito}
              />
            ))}
          </div>
          <div className="px-5 py-3 border-t border-slate-100">
            <button
              onClick={onCrearPropio}
              className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              <Plus size={13} />
              Crear requisito propio en {pilar.nombre}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function PerfilesPage() {
  const [mandanteId, setMandanteId] = useState<string | null>(null)
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [perfilId, setPerfilId] = useState<string | null>(null)
  const [pilares, setPilares] = useState<Pilar[]>([])
  const [dirties, setDirties] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogPerfil, setDialogPerfil] = useState(false)
  const [panel, setPanel] = useState<{ pilar: Pilar; requisito: RequisitoCatalogo | null } | null>(null)

  useEffect(() => {
    const s = getSession()
    if (s?.mandante_id) setMandanteId(s.mandante_id)
  }, [])

  const cargarPerfiles = useCallback((mid: string) => {
    api.get<Perfil[]>(`/api/v1/mandantes/${mid}/perfiles`)
      .then((ps) => {
        setPerfiles(ps)
        setPerfilId((actual) => actual ?? ps[0]?.id ?? null)
      })
      .catch(() => setPerfiles([]))
  }, [])

  useEffect(() => {
    if (mandanteId) cargarPerfiles(mandanteId)
  }, [mandanteId, cargarPerfiles])

  const cargarRequisitos = useCallback(() => {
    if (!mandanteId || !perfilId) return
    setDirties(new Set())
    api.get<ConfigPerfil>(`/api/v1/mandantes/${mandanteId}/requisitos?perfil_id=${perfilId}`)
      .then((cfg) => setPilares(cfg.pilares))
      .catch(() => setPilares([]))
  }, [mandanteId, perfilId])

  useEffect(() => { cargarRequisitos() }, [cargarRequisitos])

  async function handleEliminarPropio(req: Requisito) {
    setError(null)
    if (!window.confirm(`¿Eliminar el requisito propio "${req.nombre}"? Esto no afecta el catálogo global.`)) return
    try {
      await api.delete(`/api/v1/pilares/requisitos/${req.id}`)
      cargarRequisitos()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar")
    }
  }

  function handleChange(reqId: string, cambios: Partial<Requisito>) {
    setGuardado(false)
    setDirties((prev) => new Set(prev).add(reqId))
    setPilares((prev) => prev.map(p => ({
      ...p,
      requisitos: p.requisitos.map(r => r.id !== reqId ? r : { ...r, ...cambios }),
    })))
  }

  async function handleGuardar() {
    if (!mandanteId || !perfilId || dirties.size === 0) return
    setGuardando(true)
    setError(null)
    const requisitos = pilares.flatMap(p => p.requisitos).filter(r => dirties.has(r.id))
    try {
      for (const r of requisitos) {
        await api.post(`/api/v1/mandantes/${mandanteId}/perfiles/${perfilId}/requisitos`, {
          requisito_documental_id: r.id,
          es_obligatorio: r.es_obligatorio,
          vigencia_max_dias: r.vigencia_max_dias,
          umbral_deuda_max: r.umbral_deuda_max ?? 0,
        })
      }
      setDirties(new Set())
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setGuardando(false)
    }
  }

  const perfilActivo = perfiles.find(p => p.id === perfilId)
  const totalExigidos = pilares.flatMap(p => p.requisitos).filter(r => r.es_obligatorio).length

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Perfiles de exigencias</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Define qué documentos exiges por tipo de servicio — cada servicio usa un perfil
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
              <Lock size={12} className="text-slate-400" />
              Catálogo global de BERISA + tus requisitos propios
            </div>
            <button
              onClick={handleGuardar}
              disabled={dirties.size === 0 || guardando}
              className={cn(
                "flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all",
                guardado
                  ? "bg-emerald-500 text-white"
                  : dirties.size === 0
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              <Save size={14} />
              {guardando ? "Guardando..." : guardado ? "¡Guardado!" : `Guardar${dirties.size > 0 ? ` (${dirties.size})` : ""}`}
            </button>
          </div>
        </div>

        {/* Selector de perfil */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Layers size={14} className="text-slate-400" />
          {perfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setPerfilId(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                p.id === perfilId
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              )}
            >
              {p.nombre}
            </button>
          ))}
          <button
            onClick={() => setDialogPerfil(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-slate-300 text-slate-500 hover:border-slate-500 hover:text-slate-700 transition-colors"
          >
            <Plus size={12} /> Nuevo perfil
          </button>
        </div>

        {perfilActivo && (
          <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <Briefcase size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              Perfil <strong>{perfilActivo.nombre}</strong>: {totalExigidos} requisito{totalExigidos !== 1 ? "s" : ""} exigido{totalExigidos !== 1 ? "s" : ""}.
              {perfilActivo.descripcion ? ` ${perfilActivo.descripcion}.` : ""} Se aplica a los servicios que usen este perfil.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
        )}
      </div>

      {/* Pilares */}
      <div className={cn("flex-1 overflow-auto px-8 py-6 space-y-4 transition-all duration-300", panel ? "mr-96" : "")}>
        {pilares.map((pilar) => (
          <PilarSection
            key={pilar.id}
            pilar={pilar}
            dirties={dirties}
            onChange={handleChange}
            onEditRequisito={(req) => setPanel({
              pilar,
              requisito: {
                id: req.id, codigo: req.codigo, nombre: req.nombre, descripcion: req.descripcion,
                entidad_tipo: req.entidad, alcance: req.alcance, max_archivos: req.max_archivos,
              },
            })}
            onDeleteRequisito={handleEliminarPropio}
            onCrearPropio={() => setPanel({ pilar, requisito: null })}
          />
        ))}
        {pilares.length === 0 && (
          <div className="py-14 text-center bg-white rounded-xl border border-slate-200">
            <p className="text-sm text-slate-400">Cargando configuración del perfil...</p>
          </div>
        )}
      </div>

      {dialogPerfil && mandanteId && (
        <CrearPerfilDialog
          mandanteId={mandanteId}
          onClose={() => setDialogPerfil(false)}
          onCreado={(p) => {
            setPerfiles((prev) => [...prev, p])
            setPerfilId(p.id)
          }}
        />
      )}

      {/* Panel lateral — crear/editar requisito propio */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-20 transition-transform duration-300",
        panel ? "translate-x-0" : "translate-x-full"
      )}>
        {panel && (
          <RequisitoPanel
            pilar={panel.pilar}
            requisito={panel.requisito}
            contexto="propio"
            onClose={() => setPanel(null)}
            onDone={cargarRequisitos}
          />
        )}
      </div>
    </div>
  )
}
