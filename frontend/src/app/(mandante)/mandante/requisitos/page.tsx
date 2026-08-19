"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle, Briefcase, ChevronDown, ChevronRight, CheckCircle2,
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
  /** CUANDO se exige: ARRANQUE | RECURRENTE | TERMINO. */
  momento: "ARRANQUE" | "RECURRENTE" | "TERMINO"
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

const MOMENTO_OPCIONES: { v: "ARRANQUE" | "RECURRENTE" | "TERMINO"; label: string; ayuda: string }[] = [
  { v: "ARRANQUE",   label: "Al arranque",  ayuda: "Se exige antes de empezar el servicio" },
  { v: "RECURRENTE", label: "Periódico",    ayuda: "Se entrega cada período. No se exige antes de que cierre el primero: el F30-1 del mes anterior de una obra que parte hoy todavía no existe" },
  { v: "TERMINO",    label: "Al término",   ayuda: "Solo al cerrar el servicio (finiquitos, F30 final)" },
]

// ── Crear perfil ──────────────────────────────────────────────────────────────

function CrearPerfilDialog({ mandanteId, perfiles, onClose, onCreado }: {
  mandanteId: string
  /** Los que ya existen, para ofrecerlos como punto de partida. */
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
  // blanco, y ya pasó — de los primeros siete perfiles reales, cuatro no
  // exigían nada.
  const plantillas = perfiles.filter(p => (p.requisitos_exigidos ?? 0) > 0)
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
                className="w-full px-3 py-2 text-body border border-line rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Un perfil en blanco</option>
                {plantillas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {p.requisitos_exigidos} documento{p.requisitos_exigidos === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Que es una copia y no un vínculo tiene que decirlo la pantalla: si
              alguien cree que hereda, editará el perfil de origen esperando que
              el cambio baje, y lo que exige a sus contratistas se queda atrás. */}
          <p className="text-meta text-ink-muted bg-surface-app border border-line-subtle rounded-md px-3 py-2">
            {elegida
              ? `Se copiarán los ${elegida.requisitos_exigidos} documentos de «${elegida.nombre}» con sus vigencias. Después podrás editarlos sin afectar a «${elegida.nombre}».`
              : plantillas.length > 0
                ? "Parte vacío y le activas los documentos que exigirás."
                : "El perfil parte vacío. Actívale los documentos que exigirás y podrás usarlo como punto de partida para los siguientes."}
          </p>
          {error && <p className="text-body text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
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

function RequisitoRow({ req, color, dirty, onChange, onQuitar }: {
  req: Requisito
  color: string
  dirty: boolean
  onChange: (id: string, cambios: Partial<Requisito>) => void
  /** Lo saca de ESTE perfil. El borrado del catalogo vive en el buscador. */
  onQuitar: (req: Requisito) => void
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.slate

  return (
    <div className={cn(
      "rounded-lg border p-4 transition-colors group bg-surface",
      dirty ? "border-accion-line" : "border-line",
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-strong font-semibold text-ink">{req.nombre}</p>
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
                <label className="text-meta text-ink-muted whitespace-nowrap" htmlFor={`mom-${req.id}`}>
                  Se exige
                </label>
                <select
                  id={`mom-${req.id}`}
                  value={req.momento ?? "ARRANQUE"}
                  onChange={(e) => onChange(req.id, { momento: e.target.value as Requisito["momento"] })}
                  title={MOMENTO_OPCIONES.find(o => o.v === (req.momento ?? "ARRANQUE"))?.ayuda}
                  className="text-meta border border-line rounded px-2 py-1 bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  {MOMENTO_OPCIONES.map(o => (
                    <option key={o.v} value={o.v}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-meta text-ink-muted whitespace-nowrap">
                  {(req.momento ?? "ARRANQUE") === "RECURRENTE" ? "Cada (días)" : "Vigencia máx. (días)"}
                </label>
                <input
                  type="number"
                  min={1}
                  value={req.vigencia_max_dias}
                  onChange={(e) => onChange(req.id, { vigencia_max_dias: Number(e.target.value) })}
                  className="w-20 text-meta border border-line rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              {req.codigo.startsWith("F30") && (
                <div className="flex items-center gap-2">
                  <label className="text-meta text-ink-muted whitespace-nowrap">Deuda máx. ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={req.umbral_deuda_max ?? 0}
                    onChange={(e) => onChange(req.id, { umbral_deuda_max: Number(e.target.value) })}
                    className="w-28 text-meta border border-line rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              )}
          </div>
        </div>

        <div className="flex items-start gap-1.5 mt-0.5 shrink-0">
          {/* Sin opacity-0/group-hover: eso lo deja inalcanzable por teclado y
              por touch, y quitar pasa a ser el gesto cotidiano de la pantalla. */}
          <button
            onClick={() => onQuitar(req)}
            aria-label={`Quitar ${req.nombre} de este perfil`}
            title="Quitar de este perfil — no lo borra del catálogo"
            className="p-2 -m-1 rounded-md text-ink-subtle hover:bg-bloqueo-soft hover:text-bloqueo-ink focus-visible:ring-2 focus-visible:ring-brand/30 transition-colors"
          >
            <X size={14} />
          </button>
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

        <p className="text-meta text-ink-muted -mt-2">
          Son las columnas de la matriz. Cada cargo debería implicar documentos distintos:
          si a dos les pides exactamente lo mismo, sobra uno.
        </p>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {cargos.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-line-subtle bg-surface-app">
              <div className="min-w-0">
                <p className="text-body text-ink truncate">{c.nombre}</p>
                <p className="text-[10px] font-mono text-ink-subtle">{c.codigo}{c.area ? ` · ${c.area}` : ""}</p>
              </div>
              <button onClick={() => eliminar(c)} title="Eliminar"
                      className="text-ink-subtle hover:text-bloqueo-ink transition-colors shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {cargos.length === 0 && <p className="text-meta text-ink-subtle">Todavía no hay cargos.</p>}
        </div>

        <form onSubmit={crear} className="space-y-2 border-t border-line-subtle pt-3">
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="CODIGO" value={codigo} onChange={e => setCodigo(e.target.value)} required />
            <Input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} required />
            <Input placeholder="Área" value={area} onChange={e => setArea(e.target.value)} />
          </div>
          {error && <p className="text-meta text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
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
        <p className="text-strong font-medium text-ink">Pedir distinto según el cargo</p>
        <p className="text-meta text-ink-muted mt-1 max-w-2xl">
          Hoy estos {requisitos.length} documentos se le exigen igual a toda la dotación:
          al conductor, al eléctrico y a la administrativa. Creando cargos puedes pedir
          la licencia solo a quien conduce.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onSetSugerido}
            className="text-micro font-medium px-3 py-1.5 rounded-lg bg-surface-inverse text-white hover:bg-surface-inverse-hover transition-colors"
          >
            Crear set sugerido
          </button>
          <button
            onClick={onGestionar}
            className="text-meta px-3 py-1.5 rounded-lg border border-line text-ink-muted hover:border-line-strong hover:text-ink-secondary transition-colors"
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
          <p className="text-strong font-semibold text-ink">A quién se le pide cada documento</p>
          <p className="text-[11px] text-ink-muted mt-0.5">
            Sin ninguna marca, el documento se exige a toda la dotación. Se guarda al marcar.
          </p>
        </div>
        <button
          onClick={onGestionar}
          className="text-meta px-2.5 py-1 rounded-md border border-line text-ink-muted hover:border-line-strong hover:text-ink-secondary transition-colors shrink-0"
        >
          Editar cargos
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left font-medium text-ink-muted text-meta px-5 py-2.5 min-w-[16rem]">
                Requisito
              </th>
              <th className="text-center font-medium text-ink-muted text-meta px-3 py-2.5 w-20">
                Todos
              </th>
              {cargos.map(c => (
                <th key={c.id} title={c.area ?? undefined}
                    className="text-center font-medium text-ink-muted text-meta px-3 py-2.5 w-24">
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

function PilarSection({ pilar, dirties, onChange, onQuitar }: {
  pilar: Pilar
  dirties: Set<string>
  onChange: (reqId: string, cambios: Partial<Requisito>) => void
  onQuitar: (req: Requisito) => void
}) {
  const [open, setOpen] = useState(true)
  const c = COLOR_MAP[pilar.color] ?? COLOR_MAP.slate
  // Solo lo que este perfil exige. El resto del catalogo vive en el buscador de
  // "Agregar requisitos": mezclarlos era lo que impedia responder "que le pido".
  const incluidos = pilar.requisitos.filter(r => r.es_obligatorio)
  // Un pilar del que no se exige nada no ocupa espacio en la vista del perfil.
  if (incluidos.length === 0) return null

  return (
    <div className={cn("rounded-xl border overflow-hidden", c.border)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn("w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:opacity-90", c.bg)}
      >
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", c.dot)} />
        <p className={cn("text-strong font-semibold flex-1", c.text)}>{pilar.nombre}</p>
        <span className="text-meta text-ink-muted">
          {incluidos.length} documento{incluidos.length === 1 ? "" : "s"}
        </span>
        {open ? <ChevronDown size={15} className="text-ink-subtle" /> : <ChevronRight size={15} className="text-ink-subtle" />}
      </button>

      {open && (
        <div className="bg-surface">
          <div className="p-4 space-y-4">
            {agruparPorSubpilar(incluidos).map(g => (
              <div key={g.codigo} className="space-y-2">
                <p className="text-[11px] font-medium text-ink-subtle uppercase tracking-wide px-1">
                  {g.nombre}
                  <span className="ml-2 normal-case tracking-normal text-ink-subtle/70">
                    {g.requisitos.length}
                  </span>
                </p>
                {g.requisitos.map(req => (
              <RequisitoRow
                key={req.id}
                req={req}
                color={pilar.color}
                dirty={dirties.has(req.id)}
                onChange={onChange}
                onQuitar={onQuitar}
              />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Agregar requisitos al perfil ─────────────────────────────────────────────

const NIVEL_ETIQUETA: Record<string, { label: string; ayuda: string; clase: string }> = {
  BASE:     { label: "Base",     ayuda: "Obligación legal de todo empleador", clase: "bg-bloqueo-soft text-bloqueo-ink border-bloqueo-line" },
  AMPLIADO: { label: "Ampliado", ayuda: "Exigible bajo un supuesto",          clase: "bg-accion-soft text-accion-ink border-accion-line" },
  OPCIONAL: { label: "Opcional", ayuda: "Práctica de mercado",                clase: "bg-surface-sunken text-ink-muted border-line" },
}

/**
 * El catalogo completo, para elegir que sumar al perfil.
 *
 * Aqui SI va un selector, y esta bien: su trabajo es hojear 44 requisitos, y es
 * un sitio al que se entra a proposito y de vez en cuando. Lo que no funcionaba
 * era tener esos 44 como vista permanente del perfil, mezclando lo que se exige
 * con lo que no.
 *
 * Se lleva tambien el alta, la edicion y el borrado de requisitos PROPIOS. Antes
 * colgaban de la lista completa del catalogo; con la vista reducida a lo exigido,
 * un requisito propio recien creado y aun sin exigir no aparecia en ninguna parte
 * y no habia forma de volver a tocarlo nunca mas.
 */
function AgregarRequisitosDialog({ pilares, onClose, onAgregar, onCrearPropio, onEditarPropio, onEliminarPropio }: {
  pilares: Pilar[]
  onClose: () => void
  onAgregar: (ids: string[]) => void
  onCrearPropio: (pilar: Pilar) => void
  onEditarPropio: (pilar: Pilar, req: Requisito) => void
  onEliminarPropio: (req: Requisito) => void
}) {
  const [busqueda, setBusqueda] = useState("")
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  // Sin tildes de los dos lados: "poliza" tiene que encontrar "Póliza". Nadie
  // escribe tildes en un buscador, y sin esto la mitad del catálogo —que está
  // lleno de "póliza", "declaración", "médico"— es inalcanzable escribiendo
  // normal.
  const sinTildes = (t: string) =>
    t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

  const q = sinTildes(busqueda.trim())
  const disponibles = pilares
    .map(p => ({
      ...p,
      requisitos: p.requisitos.filter(r =>
        !r.es_obligatorio &&
        (!q || sinTildes(r.nombre).includes(q) || sinTildes(r.codigo).includes(q))
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
          <DialogTitle>Agregar requisitos a este perfil</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código..."
            aria-label="Buscar en el catálogo"
            className="w-full pl-9 pr-3 py-2 text-body border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div className="max-h-[52vh] overflow-y-auto space-y-5 -mx-1 px-1">
          {disponibles.map(pilar => (
            <div key={pilar.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-micro font-semibold text-ink-muted uppercase tracking-wider">
                  {pilar.nombre}
                </p>
                <button
                  type="button"
                  onClick={() => onCrearPropio(pilar)}
                  className="text-micro text-ink-subtle hover:text-ink inline-flex items-center gap-1 transition-colors"
                >
                  <Plus size={11} /> Crear uno propio
                </button>
              </div>

              {pilar.requisitos.map(req => {
                const n = NIVEL_ETIQUETA[req.nivel] ?? NIVEL_ETIQUETA.OPCIONAL
                const puesto = seleccion.has(req.id)
                return (
                  <div
                    key={req.id}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors",
                      puesto ? "border-brand-line bg-brand-soft" : "border-line hover:bg-surface-app",
                    )}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={puesto}
                      aria-label={`Agregar ${req.nombre}`}
                      onClick={() => alternar(req.id)}
                      className="flex items-start gap-3 text-left flex-1 min-w-0 focus-visible:ring-2 focus-visible:ring-brand/30 rounded"
                    >
                      {puesto
                        ? <CheckCircle2 size={15} className="text-brand shrink-0 mt-0.5" />
                        : <Circle size={15} className="text-ink-subtle shrink-0 mt-0.5" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-body text-ink">{req.nombre}</span>
                        <span className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[10px] font-mono text-ink-subtle">{req.codigo}</span>
                          {/* El nivel viaja hasta aca a proposito: es lo unico en la app
                              que distingue obligacion legal de practica de mercado, y este
                              es justo el momento en que esa diferencia decide. */}
                          <span title={n.ayuda} className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", n.clase)}>
                            {n.label}
                          </span>
                          <span className="text-[10px] text-ink-subtle">
                            {req.entidad === "EMPRESA" ? "Empresa" : "Por trabajador"}
                            {req.alcance === "SERVICIO" ? " · por cada servicio" : ""}
                          </span>
                          {req.es_propio && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-excepcion-soft text-excepcion-ink border-excepcion-line inline-flex items-center gap-1">
                              <Star size={9} /> Propio
                            </span>
                          )}
                        </span>
                      </span>
                    </button>

                    {req.es_propio && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEditarPropio(pilar, req)}
                          aria-label={`Editar ${req.nombre}`}
                          title="Editar este requisito propio"
                          className="p-1.5 rounded-md text-ink-subtle hover:bg-surface-sunken hover:text-ink-muted transition-colors"
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEliminarPropio(req)}
                          aria-label={`Eliminar ${req.nombre} del catálogo`}
                          title="Eliminar del catálogo — lo saca de TODOS tus perfiles"
                          className="p-1.5 rounded-md text-ink-subtle hover:bg-bloqueo-soft hover:text-bloqueo-ink transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {total === 0 && (
            <p className="text-body text-ink-subtle text-center py-10">
              {busqueda
                ? "Ningún requisito coincide con la búsqueda."
                : "Este perfil ya exige todos los requisitos del catálogo."}
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
            Agregar{seleccion.size > 0 ? ` ${seleccion.size}` : ""}
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
  const [perfilesCargados, setPerfilesCargados] = useState(false)
  const [perfilId, setPerfilId] = useState<string | null>(null)
  const [pilares, setPilares] = useState<Pilar[]>([])
  const [dialogCargos, setDialogCargos] = useState(false)
  const [dirties, setDirties] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogPerfil, setDialogPerfil] = useState(false)
  const [dialogAgregar, setDialogAgregar] = useState(false)
  // Quitados pero aun sin guardar. Se separan de `dirties` porque se resuelven
  // con DELETE y no con POST, y sobre todo porque QUITAR ES DESTRUCTIVO: borra
  // la fila de config con su vigencia, su umbral y su matriz de cargos, que
  // cuelga con cascade delete-orphan. Dejarlo pendiente hasta Guardar hace que
  // un misclic no afloje una exigencia en silencio.
  const [quitados, setQuitados] = useState<Set<string>>(new Set())
  // Distingue "todavia no pregunte por los requisitos" de "pregunte y este
  // perfil no exige ninguno". Antes se usaba pilares.length === 0 como
  // "cargando", y funcionaba solo porque el catalogo nunca viene vacio; con la
  // lista reducida a lo exigido, un perfil nuevo da 0 legitimamente y se
  // quedaba en "Cargando..." para siempre.
  const [requisitosCargados, setRequisitosCargados] = useState(false)
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
    setQuitados(new Set())
    api.get<ConfigPerfil>(`/api/v1/mandantes/${mandanteId}/requisitos?perfil_id=${perfilId}`)
      .then((cfg) => setPilares(cfg.pilares))
      .catch(() => setPilares([]))
      .finally(() => setRequisitosCargados(true))
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
    // "Eliminar del catalogo" y "Quitar de este perfil" son gestos distintos y
    // el texto tiene que separarlos: este saca el requisito de TODOS los
    // perfiles del mandante, no solo del que se esta mirando.
    if (!window.confirm(
      `¿Eliminar "${req.nombre}" de tu catálogo?

` +
      `Deja de estar disponible y sale de TODOS tus perfiles, no solo de este. ` +
      `Para sacarlo únicamente de este perfil, usa la X de la lista.`
    )) return
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
          // Todo lo que esta en la lista se exige. Ya no existe el caso de
          // guardar una fila apagada, que es lo que llenaba la tabla de basura.
          es_obligatorio: true,
          momento: r.momento ?? "ARRANQUE",
          vigencia_max_dias: r.vigencia_max_dias,
          umbral_deuda_max: r.umbral_deuda_max ?? 0,
        })
      }
      for (const id of quitados) {
        await api.delete(`/api/v1/mandantes/${mandanteId}/perfiles/${perfilId}/requisitos/${id}`)
      }
      setDirties(new Set())
      setQuitados(new Set())
      // El conteo por perfil alimenta el selector de plantillas del alta.
      if (mandanteId) cargarPerfiles(mandanteId)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setGuardando(false)
    }
  }

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

  // Solo lo exigido. El "6 de 38" de antes tenia sentido cuando la lista era el
  // catalogo entero; con la vista reducida, ese 38 nombra algo que no esta en
  // pantalla y hace parecer que faltan 32 por marcar.
  const exigidosEntidad = (e: "EMPRESA" | "TRABAJADOR") =>
    pilares.flatMap(p => p.requisitos).filter(r => r.entidad === e && r.es_obligatorio).length


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
  const pendientes = dirties.size + quitados.size

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-title sm:text-title font-semibold text-ink">Perfiles de exigencias</h1>
            <p className="text-body text-ink-muted mt-0.5">
              Define qué documentos exiges por tipo de servicio — cada servicio usa un perfil
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-meta text-ink-muted bg-surface-app border border-line px-3 py-2 rounded-lg">
              <Lock size={12} className="text-ink-subtle" />
              Catálogo global de BERISA + tus requisitos propios
            </div>
            <button
              onClick={handleGuardar}
              disabled={pendientes === 0 || guardando}
              className={cn(
                "flex items-center gap-2 text-strong font-medium px-4 py-2 rounded-lg transition-all",
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

        {/* 1. El PERFIL manda: define que conjunto de exigencias se esta editando.
            Va primero porque todo lo de abajo actua sobre el. */}
        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <span className="text-micro font-medium text-ink-secondary mr-1">Perfil</span>
          <Layers size={14} className="text-ink-subtle" />
          {perfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setPerfilId(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-micro font-medium border transition-colors",
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
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-micro font-medium border border-dashed border-line-strong text-ink-muted hover:border-line-strong hover:text-ink-secondary transition-colors"
          >
            <Plus size={12} /> Nuevo perfil
          </button>
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
                  "px-4 py-2 text-body transition-colors -mb-px border-b-2",
                  entidad === t.v
                    ? "border-ink text-ink font-medium"
                    : "border-transparent text-ink-muted hover:text-ink-secondary",
                )}
              >
                {t.label}
                <span className="ml-2 text-meta text-ink-subtle">
                  {exigidosEntidad(t.v)}
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
            <p className="text-meta text-bloqueo-ink">
              <strong>{perfilActivo.nombre} no exige ningún documento.</strong> Cualquier
              contratista con un servicio que use este perfil va a figurar en regla sin
              haber entregado nada. Activa los requisitos que necesitas, o crea el
              siguiente perfil partiendo desde uno que ya tengas configurado.
            </p>
          </div>
        )}

        {perfilActivo && totalExigidos > 0 && (
          <div className="mt-3 flex items-start gap-2 bg-brand-soft border border-brand-line rounded-lg px-4 py-3">
            <Briefcase size={14} className="text-brand mt-0.5 shrink-0" />
            <p className="text-meta text-brand-hover">
              Perfil <strong>{perfilActivo.nombre}</strong>: {totalExigidos} requisito{totalExigidos !== 1 ? "s" : ""} exigido{totalExigidos !== 1 ? "s" : ""}.
              {perfilActivo.descripcion ? ` ${perfilActivo.descripcion}.` : ""} Se aplica a los servicios que usen este perfil.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-body text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line rounded-lg px-4 py-2">{error}</p>
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
            onQuitar={handleQuitar}
          />
        ))}

        {/* Agregar es la accion principal de esta pantalla ahora, asi que vive
            en el flujo de la lista y no escondida en una barra. */}
        {perfilId && totalExigidos > 0 && (
          <button
            onClick={() => setDialogAgregar(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-line-strong text-body font-medium text-ink-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <Plus size={14} /> Agregar requisitos a este perfil
          </button>
        )}

        {perfilesCargados && perfiles.length === 0 && (
          <div className="py-14 text-center bg-surface rounded-xl border border-line px-6">
            <div className="space-y-3">
              <p className="text-strong font-medium text-ink">Todavía no tienes perfiles de exigencias</p>
              <p className="text-meta text-ink-subtle max-w-md mx-auto leading-relaxed">
                Un perfil define qué documentos exiges por tipo de servicio. Necesitas al
                menos uno para poder crear servicios y contratar empresas.
              </p>
              <button
                onClick={() => setDialogPerfil(true)}
                className="inline-flex items-center gap-1.5 bg-surface-inverse text-white text-micro font-medium px-3 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
              >
                <Plus size={13} /> Crear mi primer perfil
              </button>
            </div>
          </div>
        )}

        {/* Un perfil que no exige nada ya NO es lo mismo que uno cargando: con
            la lista reducida a lo exigido, cero es un estado legitimo. */}
        {perfilId && requisitosCargados && totalExigidos === 0 && (
          <div className="py-14 text-center bg-surface rounded-xl border border-dashed border-line px-6">
            <p className="text-strong font-medium text-ink">Este perfil no exige ningún documento</p>
            <p className="text-meta text-ink-subtle mt-1 max-w-md mx-auto leading-relaxed">
              Cualquier contratista con un servicio que use este perfil va a figurar en
              regla sin haber entregado nada.
            </p>
            <button
              onClick={() => setDialogAgregar(true)}
              className="mt-4 inline-flex items-center gap-2 bg-surface-inverse text-white text-body font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
            >
              <Plus size={14} /> Agregar requisitos
            </button>
          </div>
        )}

        {perfilId && !requisitosCargados && (
          <div className="py-14 text-center bg-surface rounded-xl border border-line px-6">
            <p className="text-body text-ink-subtle">Cargando configuración del perfil...</p>
          </div>
        )}
      </div>

      {dialogAgregar && (
        <AgregarRequisitosDialog
          pilares={pilares}
          onClose={() => setDialogAgregar(false)}
          onAgregar={handleAgregar}
          onCrearPropio={(pilar) => { setDialogAgregar(false); setPanel({ pilar, requisito: null }) }}
          onEditarPropio={(pilar, req) => {
            setDialogAgregar(false)
            setPanel({
              pilar,
              requisito: {
                id: req.id, codigo: req.codigo, nombre: req.nombre, descripcion: req.descripcion,
                entidad_tipo: req.entidad, alcance: req.alcance, max_archivos: req.max_archivos,
              },
            })
          }}
          onEliminarPropio={handleEliminarPropio}
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
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Panel de detalle"
 className={cn(
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
