"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Download, Eye, FileText, Inbox, RefreshCw, XCircle } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Textarea } from "@/shared/ui/textarea"

interface ArchivoPendiente {
  id: string
  orden: number
  nombre_original: string
  mime_type: string
  tamaño_bytes: number
}

interface Pendiente {
  documento_id: string
  requisito_codigo: string
  requisito_nombre: string
  pilar_id: string
  pilar_nombre: string
  contratista_razon_social: string
  trabajador_nombre: string | null
  servicio_nombre: string | null
  numero_version: number
  subido_en: string
  archivos: ArchivoPendiente[]
  /** Lo decide el backend según los pilares que este usuario puede aprobar. */
  puede_aprobar: boolean
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

// ── Dialog de revisión ────────────────────────────────────────────────────────

function RevisarDialog({ pendiente, accion, onClose, onDone }: {
  pendiente: Pendiente
  accion: "aprobar" | "observar"
  onClose: () => void
  onDone: () => void
}) {
  const [fechaVigencia, setFechaVigencia] = useState("")
  const [motivo, setMotivo] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post(`/api/v1/documentos/${pendiente.documento_id}/revisar`, {
        aprobar: accion === "aprobar",
        mensaje_brecha: accion === "observar" ? motivo : null,
        fecha_vigencia_hasta: accion === "aprobar" && fechaVigencia ? fechaVigencia : null,
      })
      onDone()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al revisar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => !loading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{accion === "aprobar" ? "Aprobar documento" : "Observar documento"}</DialogTitle>
          <DialogDescription>
            {pendiente.requisito_nombre} — {pendiente.contratista_razon_social}
            {pendiente.trabajador_nombre ? ` (${pendiente.trabajador_nombre})` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {accion === "aprobar" ? (
            <div className="space-y-2">
              <Label htmlFor="vigencia">Vigente hasta (opcional)</Label>
              <Input
                id="vigencia"
                type="date"
                value={fechaVigencia}
                onChange={(e) => setFechaVigencia(e.target.value)}
              />
              <p className="text-xs text-ink-muted">
                Fecha de vencimiento del documento, si aplica (ej. F30 vence a 30 días).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo de la observación</Label>
              <Textarea
                id="motivo"
                placeholder="Ej: El certificado está vencido, la fecha de emisión supera los 30 días..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
                rows={3}
              />
              <p className="text-xs text-ink-muted">
                El contratista verá este mensaje exacto para corregir su entrega.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || (accion === "observar" && !motivo.trim())}
              className={accion === "aprobar" ? "bg-ok-ink hover:bg-ok-ink" : "bg-bloqueo-ink hover:bg-bloqueo-ink"}
            >
              {loading ? "Guardando..." : accion === "aprobar" ? "Aprobar" : "Observar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Chip de categoría documental, con su conteo. */
function Chip({ activo, onClick, label, n, soloLectura }: {
  activo: boolean
  onClick: () => void
  label: string
  n: number
  soloLectura?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors",
        activo
          ? "border-ink bg-surface-inverse text-white font-medium"
          : "border-line text-ink-muted hover:border-line-strong hover:bg-surface-app",
      )}
    >
      {label}
      <span className={cn(
        "text-[10px] tabular-nums",
        activo ? "text-white/70" : "text-ink-subtle",
      )}>
        {n}
      </span>
      {soloLectura && (
        <Eye size={10} className={activo ? "text-white/70" : "text-ink-subtle"} aria-label="solo lectura" />
      )}
    </button>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function RevisionPage() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogo, setDialogo] = useState<{ pendiente: Pendiente; accion: "aprobar" | "observar" } | null>(null)
  /** null = todas las categorías. */
  const [pilarFiltro, setPilarFiltro] = useState<string | null>(null)
  // Que el usuario ya haya elegido un chip: sin esto, cada "Actualizar" le
  // reimpondría el filtro por defecto encima de su elección.
  const [filtroElegido, setFiltroElegido] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    api.get<Pendiente[]>("/api/v1/documentos/pendientes-revision")
      .then(setPendientes)
      .catch(() => setPendientes([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Quien solo aprueba algunos pilares abre en el suyo. Antes veía primero
  // documentos que al intentar aprobar le devolvían un 403 — una fricción que
  // introdujimos nosotros al poner permisos por pilar.
  useEffect(() => {
    if (filtroElegido || pendientes.length === 0) return
    const restringido = pendientes.some(p => !p.puede_aprobar)
    if (!restringido) return
    const suyos = pendientes.filter(p => p.puede_aprobar)
    if (suyos.length > 0) setPilarFiltro(suyos[0].pilar_id)
  }, [pendientes, filtroElegido])

  function elegirPilar(id: string | null) {
    setPilarFiltro(id)
    setFiltroElegido(true)
  }

  // Las categorías salen de los DATOS, nunca de una lista fija: los pilares son
  // un catálogo configurable —un mandante minero puede tener Ambiental o
  // Maquinaria— y cablearlas acá rompería a cualquiera fuera de los tres del seed.
  const categorias = Array.from(
    pendientes.reduce((acc, p) => {
      const prev = acc.get(p.pilar_id)
      acc.set(p.pilar_id, {
        id: p.pilar_id,
        nombre: p.pilar_nombre,
        n: (prev?.n ?? 0) + 1,
        aprobables: (prev?.aprobables ?? 0) + (p.puede_aprobar ? 1 : 0),
      })
      return acc
    }, new Map<string, { id: string; nombre: string; n: number; aprobables: number }>()).values()
  ).sort((a, b) => b.n - a.n)

  const visibles = pilarFiltro ? pendientes.filter(p => p.pilar_id === pilarFiltro) : pendientes
  const sinPermiso = pendientes.filter(p => !p.puede_aprobar).length

  async function descargar(p: Pendiente, archivo: ArchivoPendiente) {
    try {
      const r = await api.get<{ url: string }>(
        `/api/v1/documentos/${p.documento_id}/archivos/${archivo.id}/url-descarga`
      )
      window.open(r.url, "_blank")
    } catch {
      // sin acción: el botón simplemente no navega si falla
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-ink">Revisión de documentos</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Entregas de contratistas pendientes de tu aprobación
            </p>
          </div>
          <button
            onClick={cargar}
            className="flex items-center gap-2 text-sm text-ink-muted border border-line px-3 py-2 rounded-lg hover:bg-surface-app transition-colors"
          >
            <RefreshCw size={13} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 sm:px-8 py-6 space-y-4">
        {pendientes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Chip
                activo={pilarFiltro === null}
                onClick={() => elegirPilar(null)}
                label="Todas"
                n={pendientes.length}
              />
              {categorias.map(c => (
                <Chip
                  key={c.id}
                  activo={pilarFiltro === c.id}
                  onClick={() => elegirPilar(c.id)}
                  label={c.nombre}
                  n={c.n}
                  // Marca las categorías que esta persona no puede resolver, para
                  // que sepa por qué al entrar no tiene botones.
                  soloLectura={c.aprobables === 0}
                />
              ))}
            </div>
            {sinPermiso > 0 && (
              <p className="text-[11px] text-ink-subtle">
                {sinPermiso === pendientes.length
                  ? "No puedes aprobar ninguna de estas entregas: pertenecen a pilares que no tienes asignados."
                  : `${sinPermiso} ${sinPermiso === 1 ? "entrega es" : "entregas son"} de pilares que no tienes asignados — puedes verlas, no aprobarlas.`}
              </p>
            )}
          </div>
        )}

        {loading && pendientes.length === 0 && (
          <div className="py-14 text-center bg-surface rounded-xl border border-line">
            <p className="text-sm text-ink-subtle">Cargando entregas...</p>
          </div>
        )}

        {!loading && pendientes.length === 0 && (
          <div className="py-16 text-center bg-surface rounded-xl border border-line">
            <Inbox size={32} className="text-ink-subtle mx-auto mb-3" />
            <p className="text-sm font-medium text-ink-muted">No hay entregas pendientes de revisión</p>
            <p className="text-xs text-ink-subtle mt-1">Cuando un contratista suba un documento aparecerá aquí.</p>
          </div>
        )}

        {/* Vacío POR EL FILTRO, que es otra cosa: sí hay trabajo, pero no en esta
            categoría. Con el mensaje anterior parecía que la cola estaba limpia. */}
        {!loading && pendientes.length > 0 && visibles.length === 0 && (
          <div className="py-14 text-center bg-surface rounded-xl border border-dashed border-line">
            <p className="text-sm text-ink-muted">Nada pendiente en esta categoría</p>
            <button
              onClick={() => elegirPilar(null)}
              className="text-xs text-ink-muted underline mt-1 hover:text-ink"
            >
              Ver las {pendientes.length} entregas
            </button>
          </div>
        )}

        <div className="space-y-3">
          {visibles.map((p) => (
            <div key={p.documento_id} className="bg-surface rounded-xl border border-line px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-accion-soft border border-accion-line text-accion-ink flex items-center justify-center shrink-0 mt-0.5">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-ink">{p.requisito_nombre}</p>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-surface-sunken text-ink-muted border-line">
                        {p.requisito_codigo}
                      </span>
                      {p.numero_version > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-brand-soft text-brand-hover border-brand-line">
                          v{p.numero_version}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {p.contratista_razon_social}
                      {p.trabajador_nombre && <> · Trabajador: <span className="font-medium">{p.trabajador_nombre}</span></>}
                      {p.servicio_nombre && <> · Servicio: {p.servicio_nombre}</>}
                      <span className="text-ink-subtle"> · {p.pilar_nombre} · {formatFecha(p.subido_en)}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {p.archivos.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => descargar(p, a)}
                          className="flex items-center gap-1.5 text-xs text-ink-muted border border-line px-2 py-1 rounded-md hover:bg-surface-app transition-colors"
                        >
                          <Download size={11} />
                          {a.nombre_original}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sin permiso sobre este pilar no se ofrecen los botones. Antes
                    se mostraban y al pulsarlos volvía un 403: ofrecer una acción
                    que el servidor va a rechazar es peor que no ofrecerla. */}
                {p.puede_aprobar ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setDialogo({ pendiente: p, accion: "observar" })}
                      className="flex items-center gap-1.5 text-xs font-medium text-bloqueo-ink border border-bloqueo-line bg-bloqueo-soft hover:bg-bloqueo-soft px-3 py-2 rounded-lg transition-colors"
                    >
                      <XCircle size={13} /> Observar
                    </button>
                    <button
                      onClick={() => setDialogo({ pendiente: p, accion: "aprobar" })}
                      className="flex items-center gap-1.5 text-xs font-medium text-white bg-ok-ink hover:bg-ok-ink px-3 py-2 rounded-lg transition-colors"
                    >
                      <CheckCircle2 size={13} /> Aprobar
                    </button>
                  </div>
                ) : (
                  <span
                    className="shrink-0 inline-flex items-center gap-1.5 text-[11px] text-ink-subtle border border-line rounded-lg px-2.5 py-2"
                    title={`Necesitas el pilar ${p.pilar_nombre} para aprobar esta entrega`}
                  >
                    <Eye size={12} />
                    Solo lectura
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {dialogo && (
        <RevisarDialog
          pendiente={dialogo.pendiente}
          accion={dialogo.accion}
          onClose={() => setDialogo(null)}
          onDone={cargar}
        />
      )}
    </div>
  )
}
