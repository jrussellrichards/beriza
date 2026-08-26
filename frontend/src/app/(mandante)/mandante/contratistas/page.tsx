"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle, Briefcase, CheckCircle2, ChevronRight,
  FileText, History, Plus, Search, ShieldCheck, Users, X,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import {
  EstadoAgregadoBadge, EstadoBadge, estadoDocDe, LABEL_AGREGADO, LABEL_DOC,
} from "@/shared/ui/estado-badge"
import { getSession } from "@/shared/lib/auth"
import { api } from "@/shared/lib/api"
import { InvitarContratistaDialog } from "@/features/invitar-contratista/invitar-contratista-dialog"
import { HistorialDialog } from "@/entities/documento/historial-dialog"
import type { Servicio } from "@/entities/servicio/types"
import type { EstadoGlobal } from "@/shared/types"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Textarea } from "@/shared/ui/textarea"
import { Label } from "@/shared/ui/label"

// ── Tipos (espejo de contratistas-detalle) ────────────────────────────────────

interface DocDetalle {
  requisito_id: string
  requisito_codigo: string
  requisito_nombre: string
  entidad_tipo: "EMPRESA" | "TRABAJADOR"
  pilar_codigo: string
  pilar_nombre: string
  servicio_nombre: string | null
  estado: number | null
  fecha_vigencia_hasta: string | null
  mensaje_brecha: string | null
  documento_id: string | null
  /** Aprobado saltandose la brecha, no por cumplirla. */
  aprobado_por_excepcion?: boolean
}

interface PilarDetalle {
  codigo: string
  nombre: string
  color: string
  cumple: boolean
  documentos: DocDetalle[]
}

interface TrabajadorDetalle {
  id: string
  nombre: string
  rut: string
  cargo: string | null
  cumple: boolean
  documentos: DocDetalle[]
}

interface Contratista {
  id: string
  razon_social: string
  rut: string
  giro: string | null
  estado_acreditacion: EstadoGlobal
  total_trabajadores: number
  pilares: PilarDetalle[]
  trabajadores: TrabajadorDetalle[]
}

type PanelTab = "estado" | "documentos" | "trabajadores" | "servicios"

// ── Config visual ─────────────────────────────────────────────────────────────

// Estados de documento del backend: null=Falta | 1=En revisión | 2=En análisis | 3=Observado | 4=Aprobado
const PILAR_COLOR: Record<string, string> = {
  blue: "bg-brand-soft text-brand-hover border-brand-line",
  amber: "bg-accion-soft text-accion-ink border-accion-line",
  purple: "bg-excepcion-soft text-excepcion-ink border-excepcion-line",
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

// ── Dialog de excepción (sobre un documento observado) ────────────────────────

function ExcepcionDialog({ doc, onClose, onDone }: {
  doc: DocDetalle
  onClose: () => void
  onDone: () => void
}) {
  const [justificacion, setJustificacion] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!doc.documento_id) return
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("justificacion", justificacion)
      await api.upload(`/api/v1/documentos/${doc.documento_id}/aprobar-excepcion`, form)
      onDone()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al aprobar la excepción")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => !loading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aprobar por excepción</DialogTitle>
          <DialogDescription>
            {doc.requisito_nombre} — quedará aprobado pese a la observación,
            con tu justificación registrada en la bitácora del expediente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {doc.mensaje_brecha && (
            <p className="text-meta text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line rounded-md px-3 py-2">
              Observación actual: {doc.mensaje_brecha}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="just">Justificación</Label>
            <Textarea
              id="just"
              rows={3}
              placeholder="Ej: Se acepta el certificado con 35 días por acuerdo contractual vigente..."
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-body text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !justificacion.trim()} className="bg-excepcion-ink hover:bg-excepcion-ink">
              {loading ? "Aprobando..." : "Aprobar excepción"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Panel detalle ─────────────────────────────────────────────────────────────

function DocRow({ doc, onExcepcion, onVerArchivos }: {
  doc: DocDetalle
  onExcepcion: (d: DocDetalle) => void
  onVerArchivos: (d: DocDetalle) => void
}) {
  return (
    <div className="px-3 py-2 rounded-lg bg-surface border border-line-subtle">
      <div className="flex items-center gap-2.5">
        <FileText size={13} className="text-ink-subtle shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-micro font-medium text-ink truncate">
            {doc.requisito_nombre}
            {doc.servicio_nombre && <span className="text-brand font-normal"> — {doc.servicio_nombre}</span>}
          </p>
          {doc.fecha_vigencia_hasta && (
            <p className="text-[10px] text-ink-subtle">Vence: {doc.fecha_vigencia_hasta}</p>
          )}
        </div>
        {/* Aprobado por excepcion: alguien decidio dejarlo pasar con la brecha
            abierta. Fuera del dialogo de historial se veia idéntico a una
            aprobación normal, y no son lo mismo — una dice que el documento
            cumple, la otra que se asumió el riesgo. */}
        {doc.aprobado_por_excepcion && (
          <span
            title="Aprobado por excepción: se dejó pasar con la brecha abierta"
            className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-excepcion-soft text-excepcion-ink border-excepcion-line shrink-0"
          >
            excepción
          </span>
        )}
        <EstadoBadge estado={estadoDocDe(doc.estado)} />
        {doc.documento_id && (
          <button
            onClick={() => onVerArchivos(doc)}
            title="Ver archivos subidos"
            className="p-1 rounded-md hover:bg-surface-sunken text-ink-subtle hover:text-ink-muted transition-colors shrink-0"
          >
            <History size={13} />
          </button>
        )}
        {doc.estado === 3 && doc.documento_id && (
          <button
            onClick={() => onExcepcion(doc)}
            title="Aprobar por excepción justificada"
            className="text-[10px] font-medium text-excepcion-ink border border-excepcion-line bg-excepcion-soft hover:bg-excepcion-soft px-2 py-1 rounded-md transition-colors shrink-0"
          >
            Excepción
          </button>
        )}
      </div>
      {doc.estado === 3 && doc.mensaje_brecha && (
        <p className="text-[10px] text-bloqueo-ink mt-1 ml-6 flex items-start gap-1">
          <AlertCircle size={10} className="mt-px shrink-0" />
          {doc.mensaje_brecha}
        </p>
      )}
    </div>
  )
}

function ServiciosTab({ contratistaId }: { contratistaId: string }) {
  const [servicios, setServicios] = useState<Servicio[] | null>(null)

  useEffect(() => {
    api.get<Servicio[]>(`/api/v1/servicios/?contratista_id=${contratistaId}`)
      .then(setServicios)
      .catch(() => setServicios([]))
  }, [contratistaId])

  if (servicios === null) return <p className="text-meta text-ink-subtle">Cargando servicios...</p>
  if (servicios.length === 0) {
    return (
      <p className="text-meta text-ink-subtle bg-surface-app border border-line-subtle rounded-md px-3 py-2">
        Sin servicios contratados. Crea uno desde la página Servicios para que existan exigencias.
      </p>
    )
  }
  return (
    <div className="space-y-1.5">
      {servicios.map((s) => (
        <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-app border border-line-subtle">
          <div className="flex items-center gap-2.5 min-w-0">
            <Briefcase size={13} className="text-ink-subtle shrink-0" />
            <div className="min-w-0">
              <p className="text-micro font-medium text-ink truncate">{s.nombre}</p>
              <p className="text-[10px] text-ink-subtle">
                {s.codigo_referencia ? `${s.codigo_referencia} · ` : ""}Perfil: {s.perfil_nombre} · {s.trabajadores_asignados} trabajador{s.trabajadores_asignados !== 1 ? "es" : ""}
              </p>
            </div>
          </div>
          <span className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full border",
            s.estado === "ACTIVO" ? "bg-ok-soft text-ok-ink border-ok-line"
              : s.estado === "SUSPENDIDO" ? "bg-accion-soft text-accion-ink border-accion-line"
              : "bg-surface-sunken text-ink-muted border-line"
          )}>
            {s.estado === "ACTIVO" ? "Activo" : s.estado === "SUSPENDIDO" ? "Suspendido" : "Terminado"}
          </span>
        </div>
      ))}
    </div>
  )
}

function DetailPanel({ c, onClose, onCambio }: {
  c: Contratista
  onClose: () => void
  onCambio: () => void
}) {
  const [tab, setTab] = useState<PanelTab>("estado")
  const [excepcionDoc, setExcepcionDoc] = useState<DocDetalle | null>(null)
  const [historialDoc, setHistorialDoc] = useState<DocDetalle | null>(null)
  // Qué trabajador está desplegado. Uno a la vez: el panel mide w-96 y con
  // varios abiertos hay que scrollear para comparar dos personas, que es
  // justamente lo que se viene a hacer acá.
  const [trabajadorAbierto, setTrabajadorAbierto] = useState<string | null>(null)

  const trabajadoresOk = c.trabajadores.filter(t => t.cumple).length
  const docsEmpresa = c.pilares.flatMap(p => p.documentos)
  const docsTrabajadores = c.trabajadores.flatMap(t =>
    t.documentos.map(d => ({ ...d, trabajador: t.nombre }))
  )
  const totalDocs = docsEmpresa.length + docsTrabajadores.length

  const tabs: { id: PanelTab; label: string; count?: number }[] = [
    { id: "estado", label: "Estado" },
    { id: "documentos", label: "Documentos", count: totalDocs },
    { id: "trabajadores", label: "Trabajadores", count: c.trabajadores.length },
    { id: "servicios", label: "Servicios" },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-0 border-b border-line-subtle">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-sunken text-ink-muted text-[10px] font-semibold flex items-center justify-center shrink-0">
              {initials(c.razon_social)}
            </div>
            <div>
              <p className="text-strong font-semibold text-ink leading-tight">{c.razon_social}</p>
              <p className="text-meta text-ink-subtle font-mono">{c.rut}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted shrink-0">
            <X size={16} />
          </button>
        </div>
        <EstadoAgregadoBadge estado={c.estado_acreditacion} />

        <div className="flex gap-0 mt-4 -mb-px overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-micro font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.id
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-subtle hover:text-ink-muted"
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                  tab === t.id ? "bg-surface-inverse text-white" : "bg-surface-sunken text-ink-muted"
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === "estado" && (
          <div className="space-y-3">
            {c.pilares.map(pilar => {
              // `pilar.documentos` trae SOLO los de la empresa; lo que se le exige
              // a cada persona vive en `c.trabajadores`. Contar únicamente los
              // primeros hacía que esta pestaña dijera 4 brechas donde la pestaña
              // Documentos del mismo panel mostraba 7 — y justo la parte que
              // decide si alguien puede entrar a faena era la que faltaba.
              const delPilar = [
                ...pilar.documentos.map(d => ({ d, quien: "" })),
                ...docsTrabajadores
                  .filter(d => d.pilar_codigo === pilar.codigo)
                  .map(d => ({ d, quien: ` · ${d.trabajador}` })),
              ]
              const brechas = delPilar
                .filter(({ d }) => d.estado !== 4)
                .map(({ d, quien }) => d.estado === 3 && d.mensaje_brecha
                  ? `${d.mensaje_brecha}${quien}`
                  : `${d.requisito_nombre}${quien}${d.servicio_nombre ? ` (${d.servicio_nombre})` : ""}: ${LABEL_DOC[estadoDocDe(d.estado)].toLowerCase()}`)
              return (
                <div key={pilar.codigo} className="rounded-lg border border-line-subtle bg-surface-app p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-strong font-medium text-ink">{pilar.nombre}</p>
                    {pilar.cumple && brechas.length === 0
                      ? <span className="flex items-center gap-1 text-micro font-medium text-ok-ink"><CheckCircle2 size={12} /> OK</span>
                      : <span className="flex items-center gap-1 text-micro font-medium text-bloqueo-ink"><AlertCircle size={12} /> {brechas.length} brecha{brechas.length !== 1 ? "s" : ""}</span>
                    }
                  </div>
                  {brechas.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {brechas.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-meta text-ink-muted">
                          <AlertCircle size={11} className="text-bloqueo-ink mt-0.5 shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
            {c.pilares.length === 0 && (
              <p className="text-meta text-ink-subtle bg-surface-app border border-line-subtle rounded-md px-3 py-2">
                Sin servicios activos — no hay requisitos exigibles para esta empresa todavía.
              </p>
            )}
          </div>
        )}

        {tab === "documentos" && (
          <div className="space-y-5">
            {c.pilares.map(pilar => {
              const docsT = docsTrabajadores.filter(d => d.pilar_codigo === pilar.codigo)
              return (
                <div key={pilar.codigo}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", PILAR_COLOR[pilar.color] ?? "bg-surface-sunken text-ink-muted border-line")}>
                      {pilar.nombre}
                    </span>
                    <span className="text-[10px] text-ink-subtle">
                      {pilar.documentos.length + docsT.length} doc{pilar.documentos.length + docsT.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {pilar.documentos.map((doc, i) => (
                      <DocRow key={`${doc.requisito_id}-${i}`} doc={doc} onExcepcion={setExcepcionDoc} onVerArchivos={setHistorialDoc} />
                    ))}
                    {docsT.length > 0 && (
                      <div className="mt-1 ml-2 border-l-2 border-line-subtle pl-3 space-y-1.5">
                        <p className="text-[10px] text-ink-subtle font-medium uppercase tracking-wide mb-1.5">Por trabajador</p>
                        {docsT.map((doc, i) => (
                          <div key={`${doc.requisito_id}-${doc.trabajador}-${i}`}>
                            <p className="text-[10px] text-ink-subtle mb-0.5">{doc.trabajador}</p>
                            <DocRow doc={doc} onExcepcion={setExcepcionDoc} onVerArchivos={setHistorialDoc} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === "trabajadores" && (
          <div className="space-y-2">
            <p className="text-meta text-ink-subtle mb-3">
              {trabajadoresOk}/{c.trabajadores.length} trabajadores evaluados cumplen todos los requisitos
            </p>
            {c.trabajadores.map(t => {
              const abierto = trabajadorAbierto === t.id
              const brechas = t.documentos.filter(d => d.estado !== 4).length
              // Los documentos de la persona agrupados por pilar. Es la misma
              // informacion que ya estaba en la pestana Documentos, pero ahi
              // esta ordenada por pilar y hay que recorrer los cinco para
              // reconstruir a una persona. Aca se arma al reves.
              const porPilar = t.documentos.reduce<Record<string, { nombre: string; color: string; docs: DocDetalle[] }>>(
                (acc, d) => {
                  const pilar = c.pilares.find(p => p.codigo === d.pilar_codigo)
                  acc[d.pilar_codigo] ??= {
                    nombre: d.pilar_nombre,
                    color: pilar?.color ?? "",
                    docs: [],
                  }
                  acc[d.pilar_codigo].docs.push(d)
                  return acc
                },
                {},
              )

              return (
                <div key={t.id} className="rounded-lg bg-surface-app border border-line-subtle overflow-hidden">
                  <button
                    onClick={() => setTrabajadorAbierto(abierto ? null : t.id)}
                    aria-expanded={abierto}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-sunken transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight
                        size={13}
                        className={cn(
                          "text-ink-subtle shrink-0 transition-transform",
                          abierto && "rotate-90",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-strong font-medium text-ink truncate">{t.nombre}</p>
                        <p className="text-meta text-ink-subtle font-mono truncate">
                          {t.rut}{t.cargo ? ` · ${t.cargo}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-ink-subtle">
                        {t.documentos.length - brechas}/{t.documentos.length}
                      </span>
                      {t.cumple
                        ? <CheckCircle2 size={14} className="text-ok-ink" />
                        : <AlertCircle size={14} className="text-bloqueo-ink" />
                      }
                    </div>
                  </button>

                  {abierto && (
                    <div className="px-3 pb-3 pt-1 border-t border-line-subtle space-y-2.5">
                      {Object.entries(porPilar).map(([codigo, grupo]) => (
                        <div key={codigo}>
                          <span className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded border",
                            PILAR_COLOR[grupo.color] ?? "bg-surface-sunken text-ink-muted border-line",
                          )}>
                            {grupo.nombre}
                          </span>
                          <div className="space-y-1.5 mt-1.5">
                            {grupo.docs.map((doc, i) => (
                              <DocRow
                                key={`${doc.requisito_id}-${i}`}
                                doc={doc}
                                onExcepcion={setExcepcionDoc}
                                onVerArchivos={setHistorialDoc}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      {t.documentos.length === 0 && (
                        <p className="text-meta text-ink-subtle">
                          El perfil de sus servicios no exige documentos por trabajador.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {c.trabajadores.length === 0 && (
              <p className="text-meta text-ink-subtle bg-surface-app border border-line-subtle rounded-md px-3 py-2">
                Sin trabajadores asignados a servicios activos.
              </p>
            )}
          </div>
        )}

        {tab === "servicios" && <ServiciosTab contratistaId={c.id} />}
      </div>

      {excepcionDoc && (
        <ExcepcionDialog
          doc={excepcionDoc}
          onClose={() => setExcepcionDoc(null)}
          onDone={onCambio}
        />
      )}

      {historialDoc?.documento_id && (
        <HistorialDialog
          documentoId={historialDoc.documento_id}
          titulo={
            historialDoc.servicio_nombre
              ? `${historialDoc.requisito_nombre} — ${historialDoc.servicio_nombre}`
              : historialDoc.requisito_nombre
          }
          onClose={() => setHistorialDoc(null)}
        />
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ContratistasPage() {
  const [contratistas, setContratistas] = useState<Contratista[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<EstadoGlobal | "TODOS">("TODOS")
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [dialogInvitar, setDialogInvitar] = useState(false)
  const [mandanteId, setMandanteId] = useState<string | null>(null)
  const [invitado, setInvitado] = useState(false)

  const cargar = useCallback((mid: string) => {
    setLoading(true)
    api.get<Contratista[]>(`/api/v1/mandantes/${mid}/contratistas-detalle`)
      .then((data) => { setContratistas(data); setError(null) })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const s = getSession()
    if (s?.mandante_id) {
      setMandanteId(s.mandante_id)
      cargar(s.mandante_id)
    }
  }, [cargar])

  const seleccionado = contratistas.find(c => c.id === seleccionadoId) ?? null

  const filtrados = contratistas.filter(c => {
    const matchQ = c.razon_social.toLowerCase().includes(busqueda.toLowerCase()) || c.rut.includes(busqueda)
    const matchE = filtro === "TODOS" || c.estado_acreditacion === filtro
    return matchQ && matchE
  })

  // Columnas de pilares derivadas de los datos (no hardcodeadas)
  const pilarColumnas: { codigo: string; nombre: string }[] = []
  for (const c of contratistas) {
    for (const p of c.pilares) {
      if (!pilarColumnas.some(x => x.codigo === p.codigo)) {
        pilarColumnas.push({ codigo: p.codigo, nombre: p.nombre.split("—")[0].split("/")[0].trim() })
      }
    }
  }

  const kpi = {
    acreditadas: contratistas.filter(c => c.estado_acreditacion === "ACREDITADA").length,
    enProceso: contratistas.filter(c => c.estado_acreditacion === "EN_PROCESO").length,
    bloqueadas: contratistas.filter(c => c.estado_acreditacion === "BLOQUEADA").length,
  }

  return (
    <div className="flex min-h-screen">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", seleccionado ? "lg:mr-96" : "")}>

        {/* Header */}
        <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-title sm:text-title font-semibold text-ink">Contratistas</h1>
              <p className="text-body text-ink-muted mt-0.5">Gestiona y monitorea el estado de acreditación</p>
            </div>
            <button
              onClick={() => setDialogInvitar(true)}
              className="flex items-center gap-2 bg-surface-inverse text-white text-strong font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
            >
              <Plus size={15} />
              Invitar contratista
            </button>
          </div>
          {invitado && (
            <div className="mt-3 flex items-center gap-2 bg-ok-soft border border-ok-line rounded-lg px-4 py-2.5">
              <ShieldCheck size={14} className="text-ok-ink" />
              <p className="text-meta text-ok-ink">Invitación enviada — la empresa aparecerá al activar su cuenta.</p>
            </div>
          )}
        </div>

        <div className="flex-1 px-6 sm:px-8 py-6 space-y-5">

          {/* KPI. No se muestran con la cuenta vacía: cuatro ceros grandes
              ocupaban la franja más visible de la pantalla —lo primero que ve
              alguien que entra por primera vez— mientras la única acción posible
              quedaba en un botón chico del rincón. Aparecen cuando hay algo que
              indicar. */}
          {contratistas.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total", value: contratistas.length, color: "text-ink" },
              { label: "Acreditadas", value: kpi.acreditadas, color: "text-ok-ink" },
              { label: "En Proceso", value: kpi.enProceso, color: "text-accion-ink" },
              { label: "Bloqueadas", value: kpi.bloqueadas, color: "text-bloqueo-ink" },
            ].map(k => (
              <div key={k.label} className="bg-surface rounded-xl border border-line px-5 py-4">
                <p className="text-micro font-medium text-ink-muted uppercase tracking-wider">{k.label}</p>
                <p className={cn("text-metric font-semibold mt-1 tabular", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>
          )}

          {/* Filtros */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                placeholder="Buscar empresa o RUT..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-body border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"
              />
            </div>
            <div className="flex items-center gap-1 bg-surface border border-line rounded-lg p-1">
              {(["TODOS", "ACREDITADA", "EN_PROCESO", "BLOQUEADA", "PENDIENTE"] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setFiltro(e)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-micro font-medium transition-colors",
                    filtro === e ? "bg-surface-inverse text-white" : "text-ink-muted hover:text-ink"
                  )}
                >
                  {e === "TODOS" ? "Todos" : LABEL_AGREGADO[e]}
                </button>
              ))}
            </div>
            <p className="text-meta text-ink-subtle ml-auto">{filtrados.length} de {contratistas.length}</p>
          </div>

          {/* Tabla */}
          <div className="bg-surface border border-line rounded-xl overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-line-subtle bg-surface-app/60">
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">RUT</th>
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">Acreditación</th>
                  {pilarColumnas.map(p => (
                    <th key={p.codigo} className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">{p.nombre}</th>
                  ))}
                  <th className="text-left px-4 py-3 text-micro font-semibold text-ink-muted uppercase tracking-wider">
                    <Users size={12} className="inline" />
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtrados.map(c => {
                  const tOk = c.trabajadores.filter(t => t.cumple).length
                  const selected = seleccionadoId === c.id
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSeleccionadoId(selected ? null : c.id)}
                      className={cn("cursor-pointer transition-colors", selected ? "bg-surface-app" : "hover:bg-surface-app/70")}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-surface-sunken text-ink-muted text-[10px] font-semibold flex items-center justify-center shrink-0">
                            {initials(c.razon_social)}
                          </div>
                          <span className="font-medium text-ink truncate max-w-[180px]">{c.razon_social}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-ink-muted font-mono text-meta">{c.rut}</td>
                      <td className="px-4 py-3.5"><EstadoAgregadoBadge estado={c.estado_acreditacion} /></td>
                      {pilarColumnas.map(col => {
                        const p = c.pilares.find(x => x.codigo === col.codigo)
                        return (
                          <td key={col.codigo} className="px-4 py-3.5">
                            {p === undefined
                              ? <span className="text-meta text-ink-subtle">—</span>
                              : (
                                <span className={cn("inline-flex items-center gap-1 text-micro font-medium", p.cumple ? "text-ok-ink" : "text-bloqueo-ink")}>
                                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", p.cumple ? "bg-ok-ink" : "bg-bloqueo-ink")} />
                                  {p.cumple ? "OK" : "Brechas"}
                                </span>
                              )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3.5">
                        <span className={cn("text-micro font-medium", c.trabajadores.length > 0 && tOk === c.trabajadores.length ? "text-ok-ink" : "text-accion-ink")}>
                          {tOk}/{c.trabajadores.length}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <ChevronRight size={14} className={cn("text-ink-subtle transition-transform", selected && "rotate-90 text-ink-muted")} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {loading && filtrados.length === 0 && (
              <div className="py-14 text-center"><p className="text-body text-ink-subtle">Cargando contratistas...</p></div>
            )}
            {error && !loading && (
              <div className="py-14 text-center"><p className="text-body text-bloqueo-ink">No se pudieron cargar los contratistas: {error}</p></div>
            )}
            {/* "No hay ninguno todavía" y "tu filtro no encontró nada" son cosas
                distintas y estaban resueltas con el mismo mensaje de búsqueda
                vacía. La primera vez que alguien entra acá ve justamente esta
                pantalla: es la mejor oportunidad de explicar el producto, y se
                estaba gastando en un mensaje de error. */}
            {!loading && !error && filtrados.length === 0 && (
              <div className="py-14 px-6 text-center">
                {contratistas.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-strong font-medium text-ink">Todavía no invitaste ninguna empresa</p>
                    <p className="text-meta text-ink-subtle max-w-md mx-auto leading-relaxed">
                      Al invitar a una contratista, recibe un correo y carga sus documentos por su
                      cuenta. Tú defines qué se le exige en cada faena y revisas lo que entrega.
                    </p>
                    <button
                      onClick={() => setDialogInvitar(true)}
                      className="inline-flex items-center gap-1.5 bg-surface-inverse text-white text-micro font-medium px-3 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
                    >
                      <Plus size={13} /> Invitar mi primera empresa
                    </button>
                  </div>
                ) : (
                  <p className="text-body text-ink-subtle">
                    Ninguna empresa coincide con lo que buscas.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel lateral */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Panel de detalle"
 className={cn(
        "fixed right-0 top-0 h-full w-full sm:w-96 bg-surface border-l border-line shadow-xl z-20 transition-transform duration-300",
        seleccionado ? "translate-x-0" : "translate-x-full"
      )}>
        {seleccionado && mandanteId && (
          <DetailPanel
            c={seleccionado}
            onClose={() => setSeleccionadoId(null)}
            onCambio={() => cargar(mandanteId)}
          />
        )}
      </div>

      {dialogInvitar && mandanteId && (
        <InvitarContratistaDialog
          mandanteId={mandanteId}
          onClose={() => setDialogInvitar(false)}
          onSuccess={() => {
            setInvitado(true)
            setTimeout(() => setInvitado(false), 5000)
            cargar(mandanteId)
          }}
        />
      )}
    </div>
  )
}
