"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Briefcase, ChevronDown, ChevronRight, CheckCircle2,
  Circle, Edit2, Layers, Lock, Plus, Save, Search, Star, Trash2, X,
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
  blue:   { border: "border-brand-line",   bg: "bg-brand-soft",   dot: "bg-brand",   text: "text-brand-hover",   badge: "bg-brand-soft text-brand-hover border-brand-line" },
  amber:  { border: "border-accion-line",  bg: "bg-accion-soft",  dot: "bg-accion-ink",  text: "text-accion-ink",  badge: "bg-accion-soft text-accion-ink border-accion-line" },
  purple: { border: "border-excepcion-line", bg: "bg-excepcion-soft", dot: "bg-excepcion-ink", text: "text-excepcion-ink", badge: "bg-excepcion-soft text-excepcion-ink border-excepcion-line" },
  slate:  { border: "border-line",  bg: "bg-surface-app",  dot: "bg-ink-muted",  text: "text-ink-secondary",  badge: "bg-surface-sunken text-ink-muted border-line" },
}

// ── Crear perfil ──────────────────────────────────────────────────────────────

function CrearPerfilDialog({ mandanteId, perfiles, onClose, onCreado }: {
  mandanteId: string
  /** Para ofrecerlos como plantilla. */
  perfiles: Perfil[]
  onClose: () => void
  onCreado: (perfil: Perfil) => void
}) {
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [plantillaId, setPlantillaId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Solo los que exigen algo: partir de uno vacío deja igual que partir en
  // blanco, y de los primeros siete perfiles reales cuatro no exigían nada.
  const plantillas = perfiles.filter(p => (p.total_requisitos ?? 0) > 0)
  const elegida = plantillas.find(p => p.id === plantillaId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const perfil = await api.post<Perfil>(`/api/v1/mandantes/${mandanteId}/perfiles`, {
        nombre,
        descripcion: descripcion || null,
        copiar_de_perfil_id: plantillaId || null,
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
          {plantillas.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="plantilla">Partir desde</Label>
              <select
                id="plantilla"
                value={plantillaId}
                onChange={(e) => setPlantillaId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Un perfil en blanco</option>
                {plantillas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {p.total_requisitos} documento{p.total_requisitos === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Que es una copia y no un vínculo tiene que decirlo la pantalla: si
              alguien cree que hereda, va a editar la plantilla esperando que el
              cambio baje, y lo que exige a sus contratistas se quedaría atrás. */}
          <p className="text-xs text-ink-muted bg-surface-app border border-line-subtle rounded-md px-3 py-2">
            {elegida
              ? `Se copiarán los ${elegida.total_requisitos} documentos de «${elegida.nombre}» con sus vigencias. Después podrás editarlos sin afectar a «${elegida.nombre}».`
              : plantillas.length > 0
                ? "Parte vacío y le agregas los documentos que exigirás."
                : "El perfil parte vacío. Agrégale los documentos que exigirás y podrás usarlo como plantilla para los siguientes."}
          </p>
          {error && <p className="text-sm text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
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

function RequisitoRow({ req, color, dirty, onChange, onQuitar, onEdit, onDelete }: {
  req: Requisito
  color: string
  dirty: boolean
  onChange: (id: string, cambios: Partial<Requisito>) => void
  /** Lo saca de ESTE perfil. No toca el catálogo. */
  onQuitar: (req: Requisito) => void
  onEdit: (req: Requisito) => void
  onDelete: (req: Requisito) => void
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.slate

  return (
    <div className={cn(
      "rounded-lg border p-4 transition-colors group bg-surface",
      dirty ? "border-accion-line" : "border-line"
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-ink">{req.nombre}</p>
            <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", c.badge)}>
              {req.codigo}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-surface-sunken text-ink-muted border-line">
              {req.entidad === "EMPRESA" ? "Empresa" : "Trabajador"}
            </span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded border font-medium",
              req.alcance === "SERVICIO"
                ? "bg-brand-soft text-brand-hover border-brand-line"
                : "bg-surface-sunken text-ink-muted border-line"
            )}>
              {req.alcance === "SERVICIO" ? "Por cada servicio" : "Se acredita una vez"}
            </span>
            {req.es_propio && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-excepcion-soft text-excepcion-ink border-excepcion-line flex items-center gap-1">
                <Star size={9} /> Propio
              </span>
            )}
            {dirty && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-accion-soft text-accion-ink border-accion-line">
                Sin guardar
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap mt-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-ink-muted whitespace-nowrap">Vigencia máx. (días)</label>
                <input
                  type="number"
                  min={1}
                  value={req.vigencia_max_dias}
                  onChange={(e) => onChange(req.id, { vigencia_max_dias: Number(e.target.value) })}
                  className="w-20 text-xs border border-line rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              {req.codigo.startsWith("F30") && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-ink-muted whitespace-nowrap">Deuda máx. ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={req.umbral_deuda_max ?? 0}
                    onChange={(e) => onChange(req.id, { umbral_deuda_max: Number(e.target.value) })}
                    className="w-28 text-xs border border-line rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              )}
          </div>
        </div>

        <div className="flex items-start gap-1.5 mt-0.5 shrink-0">
          {req.es_propio && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(req)}
                title="Editar requisito propio"
                className="p-1 rounded-md hover:bg-surface-sunken text-ink-subtle hover:text-ink-muted transition-colors"
              >
                <Edit2 size={11} />
              </button>
              <button
                onClick={() => onDelete(req)}
                title="Eliminar requisito propio"
                className="p-1 rounded-md hover:bg-bloqueo-soft text-ink-subtle hover:text-bloqueo-ink transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
          <button
            onClick={() => onQuitar(req)}
            title="Quitar de este perfil (no lo borra del catálogo)"
            className="p-1 rounded-md text-ink-subtle hover:bg-bloqueo-soft hover:text-bloqueo-ink transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function PilarSection({ pilar, dirties, onChange, onQuitar, onEditRequisito, onDeleteRequisito, onCrearPropio }: {
  pilar: Pilar
  dirties: Set<string>
  onChange: (reqId: string, cambios: Partial<Requisito>) => void
  onQuitar: (req: Requisito) => void
  onEditRequisito: (req: Requisito) => void
  onDeleteRequisito: (req: Requisito) => void
  onCrearPropio: () => void
}) {
  const [open, setOpen] = useState(true)
  const c = COLOR_MAP[pilar.color] ?? COLOR_MAP.slate
  // Solo lo que este perfil exige. El resto del catálogo vive en "Agregar
  // documentos": mezclarlos era lo que impedía responder "¿qué le pido?".
  const incluidos = pilar.requisitos.filter(r => r.es_obligatorio)
  // Un pilar sin nada exigido no ocupa espacio en la vista del perfil.
  if (incluidos.length === 0) return null

  return (
    <div className={cn("rounded-xl border overflow-hidden", c.border)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn("w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:opacity-90", c.bg)}
      >
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", c.dot)} />
        <p className={cn("text-sm font-bold flex-1", c.text)}>{pilar.nombre}</p>
        <span className="text-xs text-ink-muted">
          {incluidos.length} documento{incluidos.length === 1 ? "" : "s"}
        </span>
        {open ? <ChevronDown size={15} className="text-ink-subtle" /> : <ChevronRight size={15} className="text-ink-subtle" />}
      </button>

      {open && (
        <div className="bg-surface">
          <div className="p-4 space-y-2">
            {incluidos.map(req => (
              <RequisitoRow
                key={req.id}
                req={req}
                color={pilar.color}
                dirty={dirties.has(req.id)}
                onChange={onChange}
                onQuitar={onQuitar}
                onEdit={onEditRequisito}
                onDelete={onDeleteRequisito}
              />
            ))}
          </div>
          <div className="px-5 py-3 border-t border-line-subtle">
            <button
              onClick={onCrearPropio}
              className="flex items-center gap-2 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
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

// ── Agregar documentos al perfil ─────────────────────────────────────────────

/**
 * El catálogo completo, para elegir qué sumar al perfil.
 *
 * Aquí SÍ va un selector, y está bien: su trabajo es hojear 44 requisitos, y es
 * un sitio al que se entra a propósito y de vez en cuando. Lo que no funcionaba
 * era tener esos 44 como vista permanente del perfil, mezclando lo que se exige
 * con lo que no.
 */
function AgregarRequisitosDialog({ pilares, onClose, onAgregar }: {
  pilares: Pilar[]
  onClose: () => void
  onAgregar: (ids: string[]) => void
}) {
  const [busqueda, setBusqueda] = useState("")
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  const q = busqueda.trim().toLowerCase()
  const disponibles = pilares
    .map(p => ({
      ...p,
      requisitos: p.requisitos.filter(r =>
        !r.es_obligatorio &&
        (!q || r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q))
      ),
    }))
    .filter(p => p.requisitos.length > 0)

  const total = disponibles.reduce((n, p) => n + p.requisitos.length, 0)

  function alternar(id: string) {
    setSeleccion(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar documentos al perfil</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto space-y-4 -mx-1 px-1">
          {disponibles.map(pilar => (
            <div key={pilar.id} className="space-y-1.5">
              <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                {pilar.nombre}
              </p>
              {pilar.requisitos.map(req => (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => alternar(req.id)}
                  className={cn(
                    "w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-lg border transition-colors",
                    seleccion.has(req.id)
                      ? "border-brand-line bg-brand-soft"
                      : "border-line hover:bg-surface-app"
                  )}
                >
                  {seleccion.has(req.id)
                    ? <CheckCircle2 size={15} className="text-brand shrink-0 mt-0.5" />
                    : <Circle size={15} className="text-ink-subtle shrink-0 mt-0.5" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{req.nombre}</span>
                    <span className="block text-[10px] text-ink-subtle font-mono">
                      {req.codigo} · {req.entidad === "EMPRESA" ? "Empresa" : "Trabajador"}
                      {req.alcance === "SERVICIO" ? " · por cada servicio" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}
          {total === 0 && (
            <p className="text-sm text-ink-subtle text-center py-10">
              {busqueda
                ? "Ningún documento coincide con la búsqueda."
                : "Este perfil ya exige todos los documentos del catálogo."}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            disabled={seleccion.size === 0}
            onClick={() => { onAgregar([...seleccion]); onClose() }}
          >
            Agregar {seleccion.size > 0 ? seleccion.size : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [dialogAgregar, setDialogAgregar] = useState(false)
  // Quitados pero aún sin guardar. Se separan de `dirties` porque se resuelven
  // con DELETE y no con POST, y porque hasta que no se guarde se puede desistir.
  const [quitados, setQuitados] = useState<Set<string>>(new Set())
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
    setQuitados(new Set())
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

  function handleQuitar(req: Requisito) {
    setGuardado(false)
    setQuitados((prev) => new Set(prev).add(req.id))
    setDirties((prev) => { const s = new Set(prev); s.delete(req.id); return s })
    setPilares((prev) => prev.map(p => ({
      ...p,
      requisitos: p.requisitos.map(r => r.id !== req.id ? r : { ...r, es_obligatorio: false }),
    })))
  }

  function handleAgregar(ids: string[]) {
    setGuardado(false)
    const nuevos = new Set(ids)
    setQuitados((prev) => { const s = new Set(prev); ids.forEach(i => s.delete(i)); return s })
    setDirties((prev) => new Set([...prev, ...ids]))
    setPilares((prev) => prev.map(p => ({
      ...p,
      requisitos: p.requisitos.map(r => !nuevos.has(r.id) ? r : { ...r, es_obligatorio: true }),
    })))
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
    if (!mandanteId || !perfilId || pendientes === 0) return
    setGuardando(true)
    setError(null)
    const requisitos = pilares.flatMap(p => p.requisitos).filter(r => dirties.has(r.id))
    try {
      for (const r of requisitos) {
        await api.post(`/api/v1/mandantes/${mandanteId}/perfiles/${perfilId}/requisitos`, {
          requisito_documental_id: r.id,
          es_obligatorio: true,
          vigencia_max_dias: r.vigencia_max_dias,
          umbral_deuda_max: r.umbral_deuda_max ?? 0,
        })
      }
      for (const id of quitados) {
        await api.delete(`/api/v1/mandantes/${mandanteId}/perfiles/${perfilId}/requisitos/${id}`)
      }
      setDirties(new Set())
      setQuitados(new Set())
      // El contador del selector de plantillas cambia al guardar.
      if (mandanteId) cargarPerfiles(mandanteId)
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
  const pendientes = dirties.size + quitados.size

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-ink">Perfiles de exigencias</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Define qué documentos exiges por tipo de servicio — cada servicio usa un perfil
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-ink-muted bg-surface-app border border-line px-3 py-2 rounded-lg">
              <Lock size={12} className="text-ink-subtle" />
              Catálogo global de BERISA + tus requisitos propios
            </div>
            <button
              onClick={handleGuardar}
              disabled={pendientes === 0 || guardando}
              className={cn(
                "flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all",
                guardado
                  ? "bg-ok-ink text-white"
                  : pendientes === 0
                    ? "bg-surface-sunken text-ink-subtle cursor-not-allowed"
                    : "bg-surface-inverse text-white hover:bg-surface-inverse-hover"
              )}
            >
              <Save size={14} />
              {guardando ? "Guardando..." : guardado ? "¡Guardado!" : `Guardar${pendientes > 0 ? ` (${pendientes})` : ""}`}
            </button>
          </div>
        </div>

        {/* Selector de perfil */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Layers size={14} className="text-ink-subtle" />
          {perfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setPerfilId(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                p.id === perfilId
                  ? "bg-surface-inverse text-white border-ink"
                  : "bg-surface text-ink-muted border-line hover:border-line-strong"
              )}
            >
              {p.nombre}
            </button>
          ))}
          <button
            onClick={() => setDialogPerfil(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-line-strong text-ink-muted hover:border-line-strong hover:text-ink-secondary transition-colors"
          >
            <Plus size={12} /> Nuevo perfil
          </button>
        </div>

        {perfilActivo && (
          <div className={cn(
            "mt-3 flex items-start gap-2 border rounded-lg px-4 py-3",
            totalExigidos === 0
              ? "bg-accion-soft border-accion-line"
              : "bg-brand-soft border-brand-line",
          )}>
            <Briefcase size={14} className={cn("mt-0.5 shrink-0", totalExigidos === 0 ? "text-accion-ink" : "text-brand")} />
            <p className={cn("text-xs", totalExigidos === 0 ? "text-accion-ink" : "text-brand-hover")}>
              {totalExigidos === 0
                ? <>Perfil <strong>{perfilActivo.nombre}</strong>: no exige ningún documento. Un servicio que lo use no le pedirá nada a su contratista.</>
                : <>Perfil <strong>{perfilActivo.nombre}</strong>: exige {totalExigidos} documento{totalExigidos !== 1 ? "s" : ""}.{perfilActivo.descripcion ? ` ${perfilActivo.descripcion}.` : ""} Se aplica a los servicios que usen este perfil.</>}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line rounded-lg px-4 py-2">{error}</p>
        )}
      </div>

      {/* Pilares */}
      <div className={cn("flex-1 px-6 sm:px-8 py-6 space-y-4 transition-all duration-300", panel ? "lg:mr-96" : "")}>
        {pilares.map((pilar) => (
          <PilarSection
            key={pilar.id}
            pilar={pilar}
            dirties={dirties}
            onChange={handleChange}
            onQuitar={handleQuitar}
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
        {totalExigidos === 0 && pilares.length > 0 && (
          <div className="py-14 text-center bg-surface rounded-xl border border-dashed border-line">
            <p className="text-sm text-ink-muted">Este perfil no exige ningún documento</p>
            <p className="text-xs text-ink-subtle mt-1 max-w-md mx-auto">
              Un servicio que use este perfil no le pedirá nada a su contratista.
              Agrega los documentos que quieras exigir.
            </p>
            <button
              onClick={() => setDialogAgregar(true)}
              className="mt-4 inline-flex items-center gap-2 bg-surface-inverse text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
            >
              <Plus size={14} /> Agregar documentos
            </button>
          </div>
        )}

        {totalExigidos > 0 && (
          <button
            onClick={() => setDialogAgregar(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-line-strong text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <Plus size={14} /> Agregar documentos a este perfil
          </button>
        )}

        {pilares.length === 0 && (
          <div className="py-14 text-center bg-surface rounded-xl border border-line">
            <p className="text-sm text-ink-subtle">Cargando configuración del perfil...</p>
          </div>
        )}
      </div>

      {dialogAgregar && (
        <AgregarRequisitosDialog
          pilares={pilares}
          onClose={() => setDialogAgregar(false)}
          onAgregar={handleAgregar}
        />
      )}

      {dialogPerfil && mandanteId && (
        <CrearPerfilDialog
          mandanteId={mandanteId}
          perfiles={perfiles}
          onClose={() => setDialogPerfil(false)}
          onCreado={(p) => {
            setPerfiles((prev) => [...prev, p])
            setPerfilId(p.id)
          }}
        />
      )}

      {/* Panel lateral — crear/editar requisito propio */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-surface border-l border-line shadow-xl z-20 transition-transform duration-300",
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
