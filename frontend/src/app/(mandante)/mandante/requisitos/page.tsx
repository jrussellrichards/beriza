"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle, Briefcase, ChevronDown, ChevronRight, CheckCircle2,
  Circle, Edit2, Layers, Lock, Plus, Save, Star, Trash2,
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
  nivel: "BASE" | "AMPLIADO" | "OPCIONAL"
  subpilar_id: string
  subpilar_codigo: string
  subpilar_nombre: string
  subpilar_orden: number
  cargo_ids: string[]
}

interface Cargo {
  id: string
  codigo: string
  nombre: string
  area: string | null
  activo: boolean
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
          <p className="text-xs text-ink-muted bg-surface-app border border-line-subtle rounded-md px-3 py-2">
            El perfil parte sin requisitos exigidos — actívalos después de crearlo.
            Cada servicio que crees podrá usar este perfil.
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

/**
 * Interruptor de "se exige o no".
 *
 * `etiqueta` no es opcional a propósito. Sin ella, esta pantalla presentaba 41
 * conmutadores idénticos y sin nombre a quien usa un lector de pantalla — y son
 * los que deciden qué documentos se le exigen a un contratista, con consecuencia
 * legal. El dato ya estaba en la fila; sólo había que pasarlo.
 *
 * El área de toque va en un envoltorio con padding transparente: el interruptor
 * sigue midiendo 20 px, que es lo que pide el diseño denso, pero se puede tocar
 * en 44 px, que es lo que pide un dedo. WCAG 2.5.8 exige 24 como mínimo.
 */
function Toggle({ checked, onChange, etiqueta }: {
  checked: boolean
  onChange: (v: boolean) => void
  etiqueta: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`Exigir ${etiqueta}`}
      title={`Exigir ${etiqueta}`}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center justify-center p-3 -m-3 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <span className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-surface-inverse" : "bg-line"
      )}>
        <span className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-surface shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )} />
      </span>
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
      req.es_obligatorio ? "bg-surface border-line" : "bg-surface-app/60 border-line-subtle",
      dirty && "border-accion-line"
    )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Toggle
            checked={req.es_obligatorio}
            onChange={(v) => onChange(req.id, { es_obligatorio: v })}
            etiqueta={req.nombre}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className={cn("text-sm font-semibold", req.es_obligatorio ? "text-ink" : "text-ink-subtle")}>
              {req.nombre}
            </p>
            <span className={cn(
              "text-[10px] font-mono px-1.5 py-0.5 rounded border",
              req.es_obligatorio ? c.badge : "bg-surface-sunken text-ink-subtle border-line"
            )}>
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

          {req.es_obligatorio && (
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
          )}
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
          {req.es_obligatorio
            ? <CheckCircle2 size={15} className="text-ok-ink shrink-0" />
            : <Circle size={15} className="text-ink-subtle shrink-0" />
          }
        </div>
      </div>
    </div>
  )
}

/**
 * Agrupa los requisitos de un pilar por subpilar, respetando el orden del catalogo.
 * El backend manda la lista plana con el subpilar en cada fila —no anidada— para no
 * romper las otras pantallas que ya la consumen, asi que el agrupado se hace aca.
 */
/**
 * Matriz de aplicabilidad: que se le pide a cada tipo de trabajador.
 *
 * Funciona aca y no del lado de Empresa por una razon de forma: son 6 requisitos
 * de persona contra 38 de empresa. Una grilla de 6 filas por unos pocos cargos se
 * lee de un vistazo; una de 38 no.
 *
 * La columna "Todos" no es un cargo: representa la lista vacia, que es el default
 * del modelo. Marcarla borra las marcas especificas.
 */
/** Alta y baja del catálogo de cargos del mandante: son las columnas de la matriz. */
function CargosDialog({ cargos, onClose, onCambio }: {
  cargos: Cargo[]
  onClose: () => void
  onCambio: () => void
}) {
  const [codigo, setCodigo] = useState("")
  const [nombre, setNombre] = useState("")
  const [area, setArea] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true); setError(null)
    try {
      await api.post("/api/v1/cargos/", { codigo, nombre, area: area || null })
      setCodigo(""); setNombre(""); setArea("")
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el cargo")
    } finally { setCargando(false) }
  }

  async function eliminar(c: Cargo) {
    setError(null)
    try {
      await api.delete(`/api/v1/cargos/${c.id}`)
      onCambio()
    } catch (err) {
      // Si el cargo está en uso el backend responde 400 con el detalle y sugiere
      // desactivarlo. Se muestra tal cual porque es accionable.
      setError(err instanceof Error ? err.message : "No se pudo eliminar")
    }
  }

  return (
    <Dialog open onOpenChange={() => !cargando && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Cargos de tu organización</DialogTitle></DialogHeader>

        <p className="text-xs text-ink-muted -mt-2">
          Son las columnas de la matriz. Cada cargo debería implicar documentos distintos:
          si a dos les pides exactamente lo mismo, sobra uno.
        </p>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {cargos.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-line-subtle bg-surface-app">
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">{c.nombre}</p>
                <p className="text-[10px] font-mono text-ink-subtle">{c.codigo}{c.area ? ` · ${c.area}` : ""}</p>
              </div>
              <button onClick={() => eliminar(c)} title="Eliminar"
                      className="text-ink-subtle hover:text-bloqueo-ink transition-colors shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {cargos.length === 0 && <p className="text-xs text-ink-subtle">Todavía no hay cargos.</p>}
        </div>

        <form onSubmit={crear} className="space-y-2 border-t border-line-subtle pt-3">
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="CODIGO" value={codigo} onChange={e => setCodigo(e.target.value)} required />
            <Input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} required />
            <Input placeholder="Área" value={area} onChange={e => setArea(e.target.value)} />
          </div>
          {error && <p className="text-xs text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
            <Button type="submit" disabled={cargando || !codigo.trim() || !nombre.trim()}>Agregar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


function MatrizCargos({ requisitos, cargos, guardando, onCambiar, onGestionar, onSetSugerido }: {
  requisitos: Requisito[]
  cargos: Cargo[]
  guardando: string | null
  onCambiar: (req: Requisito, cargoIds: string[]) => void
  onGestionar: () => void
  onSetSugerido: () => void
}) {
  if (requisitos.length === 0) return null

  if (cargos.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface px-5 py-4">
        <p className="text-sm font-medium text-ink">Pedir distinto según el cargo</p>
        <p className="text-xs text-ink-muted mt-1 max-w-2xl">
          Hoy estos {requisitos.length} documentos se le exigen igual a toda la dotación:
          al conductor, al eléctrico y a la administrativa. Creando cargos puedes pedir
          la licencia solo a quien conduce.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onSetSugerido}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-surface-inverse text-white hover:bg-surface-inverse-hover transition-colors"
          >
            Crear set sugerido
          </button>
          <button
            onClick={onGestionar}
            className="text-xs px-3 py-1.5 rounded-lg border border-line text-ink-muted hover:border-line-strong hover:text-ink-secondary transition-colors"
          >
            Crearlos yo
          </button>
          <span className="text-[11px] text-ink-subtle">
            5 cargos genéricos que puedes renombrar o borrar
          </span>
        </div>
      </div>
    )
  }

  function alternar(req: Requisito, cargoId: string) {
    const actual = new Set(req.cargo_ids)
    if (actual.has(cargoId)) actual.delete(cargoId)
    else actual.add(cargoId)
    onCambiar(req, Array.from(actual))
  }

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-surface-app/60 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink">A quién se le pide cada documento</p>
          <p className="text-[11px] text-ink-muted mt-0.5">
            Sin ninguna marca, el documento se exige a toda la dotación. Se guarda al marcar.
          </p>
        </div>
        <button
          onClick={onGestionar}
          className="text-xs px-2.5 py-1 rounded-md border border-line text-ink-muted hover:border-line-strong hover:text-ink-secondary transition-colors shrink-0"
        >
          Editar cargos
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left font-medium text-ink-muted text-xs px-5 py-2.5 min-w-[16rem]">
                Requisito
              </th>
              <th className="text-center font-medium text-ink-muted text-xs px-3 py-2.5 w-20">
                Todos
              </th>
              {cargos.map(c => (
                <th key={c.id} title={c.area ?? undefined}
                    className="text-center font-medium text-ink-muted text-xs px-3 py-2.5 w-24">
                  {c.nombre.length > 14 ? c.nombre.slice(0, 13) + "…" : c.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {requisitos.map(req => {
              const todos = req.cargo_ids.length === 0
              return (
                <tr key={req.id} className={cn("hover:bg-surface-app/50", guardando === req.id && "opacity-60")}>
                  <td className="px-5 py-2.5">
                    <span className="text-ink">{req.nombre.length > 52 ? req.nombre.slice(0, 51) + "…" : req.nombre}</span>
                    <span className="ml-2 text-[10px] font-mono text-ink-subtle">{req.codigo}</span>
                  </td>
                  <td className="text-center px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={todos}
                      disabled={guardando !== null}
                      onChange={() => onCambiar(req, [])}
                      title="Se exige a toda la dotación"
                    />
                  </td>
                  {cargos.map(c => (
                    <td key={c.id} className="text-center px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={req.cargo_ids.includes(c.id)}
                        disabled={guardando !== null}
                        onChange={() => alternar(req, c.id)}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="px-5 py-2.5 text-[11px] text-ink-subtle border-t border-line-subtle">
        A quien no tenga cargo declarado en la faena se le exige <strong>todo</strong>, incluso lo
        restringido. Así, omitir el cargo nunca baja las exigencias de alguien.
      </p>
    </div>
  )
}

function agruparPorSubpilar(reqs: Requisito[]) {
  const mapa = new Map<string, { codigo: string; nombre: string; orden: number; requisitos: Requisito[] }>()
  for (const r of reqs) {
    const g = mapa.get(r.subpilar_codigo)
    if (g) g.requisitos.push(r)
    else mapa.set(r.subpilar_codigo, {
      codigo: r.subpilar_codigo, nombre: r.subpilar_nombre,
      orden: r.subpilar_orden ?? 0, requisitos: [r],
    })
  }
  return Array.from(mapa.values()).sort((a, b) => a.orden - b.orden)
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
        <span className="text-xs text-ink-muted">{obligatorios}/{pilar.requisitos.length} exigidos</span>
        {open ? <ChevronDown size={15} className="text-ink-subtle" /> : <ChevronRight size={15} className="text-ink-subtle" />}
      </button>

      {open && (
        <div className="bg-surface">
          <div className="p-4 space-y-4">
            {agruparPorSubpilar(pilar.requisitos).map(g => (
              <div key={g.codigo} className="space-y-2">
                <p className="text-[11px] font-medium text-ink-subtle uppercase tracking-wide px-1">
                  {g.nombre}
                  <span className="ml-2 normal-case tracking-normal text-ink-subtle/70">
                    {g.requisitos.filter(r => r.es_obligatorio).length}/{g.requisitos.length}
                  </span>
                </p>
                {g.requisitos.map(req => (
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

// ── Página ────────────────────────────────────────────────────────────────────

export default function PerfilesPage() {
  const [mandanteId, setMandanteId] = useState<string | null>(null)
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [perfilesCargados, setPerfilesCargados] = useState(false)
  const [perfilId, setPerfilId] = useState<string | null>(null)
  const [pilares, setPilares] = useState<Pilar[]>([])
  const [dialogCargos, setDialogCargos] = useState(false)
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
      // Distingue "todavia no pregunte" de "pregunte y no hay ninguno". Sin esa
      // diferencia, un mandante recien creado se quedaba para siempre en
      // "Cargando configuracion del perfil...".
      .finally(() => setPerfilesCargados(true))
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

  const cargarCargos = useCallback(() => {
    api.get<Cargo[]>("/api/v1/cargos/")
      .then(setCargos)
      .catch(() => setCargos([]))
  }, [])

  useEffect(() => { cargarCargos() }, [cargarCargos])

  async function handleSetSugerido() {
    setError(null)
    try {
      await api.post("/api/v1/cargos/set-sugerido", {})
      cargarCargos()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el set sugerido")
    }
  }

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

  // Aplicar plantilla: pone el perfil en un punto de partida sensato de una vez.
  // Sin esto, arrancar un perfil sobre el catalogo de 44 requisitos es marcar
  // casillas una por una, con un request por casilla.
  const [aplicando, setAplicando] = useState<string | null>(null)

  // Dos ejes de filtro. Son preguntas distintas y por eso son controles distintos:
  //   entidad = a QUIEN se le pide (la empresa una vez, o cada persona)
  //   nivel   = POR QUE se puede pedir (obligacion legal, condicional, practica)
  // El de entidad es pestana porque el mandante mira una cosa o la otra, nunca
  // ambas a la vez: son 38 requisitos de empresa contra 6 de persona, y esa
  // asimetria hace inutil la lista mezclada.
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [guardandoCargo, setGuardandoCargo] = useState<string | null>(null)

  const [entidad, setEntidad] = useState<"EMPRESA" | "TRABAJADOR">("EMPRESA")
  const [nivelesVisibles, setNivelesVisibles] = useState<Set<string>>(
    new Set(["BASE", "AMPLIADO", "OPCIONAL"]),
  )

  function alternarNivel(n: string) {
    setNivelesVisibles(prev => {
      const s = new Set(prev)
      if (s.has(n)) s.delete(n); else s.add(n)
      return s
    })
  }

  // Se filtra para MOSTRAR, nunca para guardar: `dirties` guarda por id y el
  // guardado recorre todos los pilares, asi que cambiar de pestana con cambios
  // pendientes no los pierde.
  const pilaresVisibles = pilares
    .map(p => ({
      ...p,
      requisitos: p.requisitos.filter(
        r => r.entidad === entidad && nivelesVisibles.has(r.nivel),
      ),
    }))
    .filter(p => p.requisitos.length > 0)

  // La matriz NO se filtra por nivel a proposito. "Mostrar" es una preferencia de
  // lectura sobre la lista de abajo, pero aplicada aca escondia filas y un cargo
  // parecia no tener exigido un documento que en realidad si tiene: la matriz
  // dejaba de describir la configuracion y pasaba a describir el filtro. Se
  // muestra todo lo exigido a personas, que es lo que las reglas evaluan.
  const requisitosMatriz = pilares
    .flatMap(p => p.requisitos)
    .filter(r => r.entidad === "TRABAJADOR" && r.es_obligatorio)

  const cuentaEntidad = (e: "EMPRESA" | "TRABAJADOR") =>
    pilares.flatMap(p => p.requisitos).filter(r => r.entidad === e).length
  const exigidosEntidad = (e: "EMPRESA" | "TRABAJADOR") =>
    pilares.flatMap(p => p.requisitos).filter(r => r.entidad === e && r.es_obligatorio).length

  async function handlePlantilla(nombre: string) {
    if (!mandanteId || !perfilId) return
    setAplicando(nombre)
    setError(null)
    try {
      const r = await api.post<{ exigidos: number; activados: number; desactivados: number }>(
        `/api/v1/mandantes/${mandanteId}/perfiles/${perfilId}/plantilla`,
        { plantilla: nombre },
      )
      cargarRequisitos()
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
      console.info(`Plantilla ${nombre}: ${r.exigidos} exigidos`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar la plantilla")
    } finally {
      setAplicando(null)
    }
  }

  /**
   * Guarda a que cargos aplica un requisito. Es un PUT con la lista COMPLETA:
   * lista vacia devuelve el requisito a "aplica a todos", que es el default.
   * Se guarda al toque y no con el boton Guardar porque es otra entidad —no
   * pasa por `dirties`, que gobierna la config del requisito.
   */
  async function guardarCargos(req: Requisito, cargoIds: string[]) {
    if (!mandanteId || !perfilId) return
    setGuardandoCargo(req.id)
    setError(null)
    // Optimista: la grilla responde al instante y se corrige si el PUT falla.
    setPilares(prev => prev.map(p => ({
      ...p,
      requisitos: p.requisitos.map(r => r.id === req.id ? { ...r, cargo_ids: cargoIds } : r),
    })))
    try {
      await api.put(
        `/api/v1/mandantes/${mandanteId}/perfiles/${perfilId}/requisitos/${req.id}/cargos`,
        { cargo_ids: cargoIds },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la aplicabilidad por cargo")
      cargarRequisitos()
    } finally {
      setGuardandoCargo(null)
    }
  }

  const perfilActivo = perfiles.find(p => p.id === perfilId)
  const totalExigidos = pilares.flatMap(p => p.requisitos).filter(r => r.es_obligatorio).length

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
              disabled={dirties.size === 0 || guardando}
              className={cn(
                "flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all",
                guardado
                  ? "bg-ok-ink text-white"
                  : dirties.size === 0
                    ? "bg-surface-sunken text-ink-subtle cursor-not-allowed"
                    : "bg-surface-inverse text-white hover:bg-surface-inverse-hover"
              )}
            >
              <Save size={14} />
              {guardando ? "Guardando..." : guardado ? "¡Guardado!" : `Guardar${dirties.size > 0 ? ` (${dirties.size})` : ""}`}
            </button>
          </div>
        </div>

        {/* 1. El PERFIL manda: define que conjunto de exigencias se esta editando.
            Va primero porque todo lo de abajo actua sobre el. */}
        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-ink-secondary mr-1">Perfil</span>
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

        {/* 2. Accion masiva SOBRE el perfil de arriba, no una propiedad suya. */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-ink-subtle">Aplicar plantilla</span>
          {[
            { n: "ARRANQUE", label: "Arranque", ayuda: "Lo mínimo, obtenible en línea" },
            { n: "COMPLETA", label: "Legal completa", ayuda: "Todo lo que exige la ley" },
            { n: "OBRA", label: "Obra física", ayuda: "Legal + lo de faena" },
          ].map(pl => (
            <button
              key={pl.n}
              title={pl.ayuda}
              disabled={!perfilId || aplicando !== null}
              onClick={() => handlePlantilla(pl.n)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md border transition-colors",
                aplicando === pl.n
                  ? "border-ink bg-surface-inverse text-white"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink-secondary",
                (!perfilId || aplicando !== null) && "opacity-60 cursor-not-allowed",
              )}
            >
              {aplicando === pl.n ? "Aplicando..." : pl.label}
            </button>
          ))}
          <span className="text-[10px] text-ink-subtle">
            Reemplaza lo exigido en este perfil; conserva vigencias ya configuradas
          </span>
        </div>

        {/* 3. Solo filtros de VISTA sobre el mismo perfil. No son dos perfiles. */}
        <div className="mt-4 flex items-center justify-between gap-4 flex-wrap border-b border-line">
          <div className="flex items-center gap-0">
            {([
              { v: "EMPRESA" as const, label: "Empresa", ayuda: "Se acredita una vez" },
              { v: "TRABAJADOR" as const, label: "Personas", ayuda: "Por cada trabajador" },
            ]).map(t => (
              <button
                key={t.v}
                onClick={() => setEntidad(t.v)}
                title={t.ayuda}
                className={cn(
                  "px-4 py-2 text-sm transition-colors -mb-px border-b-2",
                  entidad === t.v
                    ? "border-ink text-ink font-medium"
                    : "border-transparent text-ink-muted hover:text-ink-secondary",
                )}
              >
                {t.label}
                <span className="ml-2 text-xs text-ink-subtle">
                  {exigidosEntidad(t.v)} de {cuentaEntidad(t.v)}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 pb-2">
            <span className="text-[10px] text-ink-subtle mr-0.5">Mostrar</span>
            {([
              { n: "BASE", label: "Base", ayuda: "Obligacion legal de todo empleador en Chile" },
              { n: "AMPLIADO", label: "Ampliado", ayuda: "Exigible solo si se cumple un supuesto" },
              { n: "OPCIONAL", label: "Opcional", ayuda: "Practica de mercado, no obligacion legal" },
            ]).map(f => (
              <button
                key={f.n}
                title={f.ayuda}
                onClick={() => alternarNivel(f.n)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded border transition-colors",
                  nivelesVisibles.has(f.n)
                    ? "border-ink bg-surface-inverse text-white"
                    : "border-line text-ink-subtle hover:border-line-strong",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Un perfil sin requisitos es el estado mas peligroso que puede tener
            este producto: cualquier contratista que lo use aparece cumpliendo
            sin haber entregado un solo documento. Antes se informaba "0
            requisitos exigidos" con la misma neutralidad con que se informaria
            12, en el mismo recuadro azul. Ahora se dice en voz alta. */}
        {perfilActivo && totalExigidos === 0 && (
          <div className="mt-3 flex items-start gap-2 bg-bloqueo-soft border border-bloqueo-line rounded-lg px-4 py-3">
            <AlertCircle size={14} className="text-bloqueo-ink mt-0.5 shrink-0" />
            <p className="text-xs text-bloqueo-ink">
              <strong>{perfilActivo.nombre} no exige ningún documento.</strong> Cualquier
              contratista con un servicio que use este perfil va a figurar en regla sin
              haber entregado nada. Activa los requisitos que necesitas, o aplica una
              plantilla para partir.
            </p>
          </div>
        )}

        {perfilActivo && totalExigidos > 0 && (
          <div className="mt-3 flex items-start gap-2 bg-brand-soft border border-brand-line rounded-lg px-4 py-3">
            <Briefcase size={14} className="text-brand mt-0.5 shrink-0" />
            <p className="text-xs text-brand-hover">
              Perfil <strong>{perfilActivo.nombre}</strong>: {totalExigidos} requisito{totalExigidos !== 1 ? "s" : ""} exigido{totalExigidos !== 1 ? "s" : ""}.
              {perfilActivo.descripcion ? ` ${perfilActivo.descripcion}.` : ""} Se aplica a los servicios que usen este perfil.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line rounded-lg px-4 py-2">{error}</p>
        )}
      </div>

      {/* Matriz cargo x requisito. Solo en Personas: un documento de la empresa
          no depende del cargo de nadie. */}
      {entidad === "TRABAJADOR" && (
        <div className="px-6 sm:px-8 pt-6">
          <MatrizCargos
            requisitos={requisitosMatriz}
            cargos={cargos}
            guardando={guardandoCargo}
            onCambiar={guardarCargos}
            onGestionar={() => setDialogCargos(true)}
            onSetSugerido={handleSetSugerido}
          />
        </div>
      )}

      {dialogCargos && (
        <CargosDialog
          cargos={cargos}
          onClose={() => setDialogCargos(false)}
          onCambio={cargarCargos}
        />
      )}

      {/* Pilares */}
      <div className={cn("flex-1 px-6 sm:px-8 py-6 space-y-4 transition-all duration-300", panel ? "lg:mr-96" : "")}>
        {pilaresVisibles.map((pilar) => (
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
          <div className="py-14 text-center bg-surface rounded-xl border border-line px-6">
            {perfilesCargados && perfiles.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">Todavía no tienes perfiles de exigencias</p>
                <p className="text-xs text-ink-subtle max-w-md mx-auto leading-relaxed">
                  Un perfil define qué documentos exiges por tipo de servicio. Necesitas al
                  menos uno para poder crear servicios y contratar empresas.
                </p>
                <button
                  onClick={() => setDialogPerfil(true)}
                  className="inline-flex items-center gap-1.5 bg-surface-inverse text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
                >
                  <Plus size={13} /> Crear mi primer perfil
                </button>
              </div>
            ) : (
              <p className="text-sm text-ink-subtle">Cargando configuración del perfil...</p>
            )}
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
        "fixed right-0 top-0 h-full w-full sm:w-96 bg-surface border-l border-line shadow-xl z-20 transition-transform duration-300",
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
