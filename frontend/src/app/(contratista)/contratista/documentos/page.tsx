"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Building2, ChevronDown, ChevronRight, FileText,
  Lock, LockOpen, Search, Upload, Users,
} from "lucide-react"
import { cn, siglaVisible } from "@/shared/lib/utils"
import { SubirDocumentoDialog, type RequisitoSubida } from "@/features/subir-documento/subir-documento-dialog"
import { HistorialDialog } from "@/entities/documento/historial-dialog"
import { BadgesMandante } from "@/entities/documento/badges-mandante"
import { ResolverSolicitudDialog } from "@/features/subir-documento/resolver-solicitud-dialog"
import { PILAR_COLOR, PILAR_DEFAULT } from "@/entities/documento/exigencia"
import { documentoAlDia, type DocumentoContratista, type EstadoPorMandante } from "@/entities/contratista/resumen"
import { Ratio } from "@/shared/ui/ratio"
import { getSession } from "@/shared/lib/auth"
import { api } from "@/shared/lib/api"

type Ambito = "EMPRESA" | "TRABAJADORES"

/**
 * Un documento del contratista, con el estado de cada cliente que lo exige.
 *
 * Antes había una fila por (documento, mandante) y la página mostraba un solo
 * mandante — el que el token eligiera al azar. Ahora el F30 es UNA fila con N
 * badges: es lo que hace visible que se sube una vez y sirve para todos.
 */
function DocumentoRow({ doc, onSubir, onHistorial, onSensibilidad, onResolver }: {
  doc: DocumentoContratista
  onSubir: (d: DocumentoContratista) => void
  onHistorial: (d: DocumentoContratista, m: EstadoPorMandante) => void
  onSensibilidad: (d: DocumentoContratista) => void
  onResolver: (d: DocumentoContratista, m: EstadoPorMandante) => void
}) {
  return (
    <div className="bg-surface border border-line rounded-xl px-4 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            {/* La faena va EN el título, no como etiqueta chica al lado del
                código. Un requisito por servicio aparece una vez por faena, así
                que dos filas seguidas se leían con el mismo nombre y sólo se
                distinguían en 10 px: parecía un error de la aplicación, y el
                riesgo real era subir el archivo en la fila equivocada. El dato
                que distingue tiene que estar donde el ojo compara. */}
            <p className="text-sm font-medium text-ink">
              {doc.requisito_nombre}
              {doc.servicio_nombre && (
                <span className="text-brand"> — {doc.servicio_nombre}</span>
              )}
            </p>
            {siglaVisible(doc.requisito_codigo) && (
              <span className="text-[10px] font-mono text-ink-subtle">{doc.requisito_codigo}</span>
            )}
            {doc.sensible && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-excepcion-soft text-excepcion-ink border border-excepcion-line">
                <Lock size={9} /> sensible
              </span>
            )}
          </div>
          <div className="mt-2">
            <BadgesMandante
              mandantes={doc.mandantes}
              onSelect={m => onHistorial(doc, m)}
              onAutorizar={m => onResolver(doc, m)}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {doc.expediente_id && (
            <button
              onClick={() => onSensibilidad(doc)}
              title="Definir si se comparte sin pedirte autorización"
              className="p-2 rounded-lg text-ink-subtle hover:text-ink-secondary hover:bg-surface-app transition-colors"
            >
              {doc.sensible ? <Lock size={14} /> : <LockOpen size={14} />}
            </button>
          )}
          <button
            onClick={() => onSubir(doc)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-inverse text-white hover:bg-surface-inverse-hover transition-colors"
          >
            <Upload size={12} />
            Subir
          </button>
        </div>
      </div>
    </div>
  )
}

function Grupo({ titulo, color, docs, children }: {
  titulo: string
  color: string | null
  docs: DocumentoContratista[]
  children: (d: DocumentoContratista) => React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  const c = (color && PILAR_COLOR[color]) || PILAR_DEFAULT

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left rounded-lg transition-opacity hover:opacity-90", c.bg)}
      >
        <span className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />
        <p className={cn("text-xs font-semibold flex-1 uppercase tracking-wider", c.text)}>{titulo}</p>
        {/* Antes acá iba `docs.length`, que responde "¿cuántos tengo?". La
            pregunta real del contratista es "¿estoy en regla?", y solo la razón
            la contesta. */}
        <Ratio n={docs.filter(d => documentoAlDia(d)).length} total={docs.length} etiqueta="al día" />
        {open ? <ChevronDown size={13} className="text-ink-subtle" /> : <ChevronRight size={13} className="text-ink-subtle" />}
      </button>
      {open && <div className="space-y-2 mt-2">{docs.map(children)}</div>}
    </div>
  )
}

/** El contratista decide si este documento suyo se comparte sin preguntarle. */
function SensibilidadDialog({ doc, onClose, onDone }: {
  doc: DocumentoContratista
  onClose: () => void
  onDone: () => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(sensible: boolean | null) {
    setGuardando(true)
    setError(null)
    try {
      await api.patch(`/api/v1/reutilizacion/expedientes/${doc.expediente_id}/sensibilidad`, { sensible })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setGuardando(false)
    }
  }

  // Solo dos opciones. La que rige hoy —sea porque la eligió el contratista o
  // porque es el default del catálogo— viene marcada; no se le pide entender
  // qué definió BERISA, que es un concepto ajeno a él.
  const opciones = [
    {
      valor: true as const, icono: Lock, titulo: "Pedirme autorización",
      texto: "Ningún cliente nuevo lo verá hasta que yo lo apruebe.",
      deshabilitado: false,
    },
    {
      valor: false as const, icono: LockOpen, titulo: "Compartir sin preguntar",
      texto: doc.puede_relajar
        ? "Cualquier cliente que lo exija lo recibe de inmediato."
        : "No disponible: contiene datos personales de un trabajador, y esa protección no es tuya para renunciar.",
      deshabilitado: !doc.puede_relajar,
    },
  ]

  return (
    <div className="fixed inset-0 bg-surface-inverse/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-semibold text-ink">Compartir este documento</p>
        <p className="text-xs text-ink-muted mt-1">{doc.requisito_nombre}</p>
        {doc.sensible && doc.puede_relajar && (
          <p className="text-[11px] text-excepcion-ink bg-excepcion-soft border border-excepcion-line rounded-md px-2.5 py-1.5 mt-3">
            Si eliges compartir sin preguntar, las solicitudes que ya estén esperando tu
            autorización se aprueban de inmediato.
          </p>
        )}

        <div className="mt-4 space-y-2">
          {opciones.map(({ valor, icono: Icono, titulo, texto, deshabilitado }) => {
            const activo = doc.sensible === valor
            return (
              <button
                key={String(valor)}
                onClick={() => guardar(valor)}
                disabled={guardando || deshabilitado}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg border transition-colors",
                  deshabilitado
                    ? "border-line-subtle opacity-50 cursor-not-allowed"
                    : activo
                      ? "border-ink bg-surface-app"
                      : "border-line hover:border-line-strong"
                )}
              >
                <span className="text-sm text-ink flex items-center gap-2">
                  <Icono size={13} /> {titulo}
                  {activo && <span className="text-[10px] text-ink-muted">· actual</span>}
                </span>
                <span className="block text-[11px] text-ink-muted mt-0.5">{texto}</span>
              </button>
            )
          })}
        </div>

        {error && <p className="text-xs text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md mt-3">{error}</p>}

        <button onClick={onClose} className="w-full mt-4 py-2 text-sm text-ink-muted hover:text-ink">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function DocumentosPage() {
  const [contratistaId, setContratistaId] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocumentoContratista[]>([])
  const [loading, setLoading] = useState(true)
  // Se puede llegar apuntando a un documento concreto desde la bandeja de
  // pendientes ("Subir corrección"), que manda el código del requisito y la
  // pestaña donde vive. Sin esto, el botón dejaba al contratista en la lista
  // completa sin pista de cuál era el documento observado.
  const destino = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams()
  const [ambito, setAmbito] = useState<Ambito>(
    destino.get("ambito") === "TRABAJADORES" ? "TRABAJADORES" : "EMPRESA",
  )
  const [busqueda, setBusqueda] = useState(destino.get("buscar") ?? "")
  const [filtroMandante, setFiltroMandante] = useState("TODOS")
  const [filtroEstado, setFiltroEstado] = useState("TODOS")
  const [subirDoc, setSubirDoc] = useState<DocumentoContratista | null>(null)
  const [historial, setHistorial] = useState<{ doc: DocumentoContratista; m: EstadoPorMandante } | null>(null)
  const [sensibilidadDoc, setSensibilidadDoc] = useState<DocumentoContratista | null>(null)
  const [solicitud, setSolicitud] = useState<{ doc: DocumentoContratista; m: EstadoPorMandante } | null>(null)

  const cargar = useCallback(() => {
    setLoading(true)
    api.get<DocumentoContratista[]>("/api/v1/documentos/mis-documentos")
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setContratistaId(getSession()?.contratista_id ?? null)
    cargar()
  }, [cargar])

  // El cliente es un FILTRO opcional, no un modo: por defecto se ven todos.
  const mandantes = useMemo(() => {
    const m = new Map<string, string>()
    docs.forEach(d => d.mandantes.forEach(x => m.set(x.mandante_id, x.mandante_razon_social)))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [docs])

  const visibles = docs
    .filter(d => ambito === "EMPRESA" ? !d.trabajador_id : !!d.trabajador_id)
    .filter(d => filtroMandante === "TODOS" || d.mandantes.some(m => m.mandante_id === filtroMandante))
    .filter(d => {
      if (filtroEstado === "TODOS") return true
      if (filtroEstado === "FALTA") return d.mandantes.some(m => m.estado === null)
      return d.mandantes.some(m => String(m.estado) === filtroEstado)
    })
    .filter(d => {
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return d.requisito_nombre.toLowerCase().includes(q)
        || d.requisito_codigo.toLowerCase().includes(q)
        || (d.trabajador_nombre ?? "").toLowerCase().includes(q)
        || (d.servicio_nombre ?? "").toLowerCase().includes(q)
    })

  const totalEmpresa = docs.filter(d => !d.trabajador_id).length
  const totalTrabajadores = docs.filter(d => !!d.trabajador_id).length

  // Empresa se agrupa por pilar; Trabajadores, por persona.
  const grupos = useMemo(() => {
    const g = new Map<string, { titulo: string; color: string | null; docs: DocumentoContratista[] }>()
    visibles.forEach(d => {
      const clave = ambito === "EMPRESA" ? (d.pilar_codigo ?? "OTROS") : (d.trabajador_id ?? "?")
      if (!g.has(clave)) {
        g.set(clave, {
          titulo: ambito === "EMPRESA" ? (d.pilar_nombre ?? "Otros") : (d.trabajador_nombre ?? "Sin nombre"),
          color: ambito === "EMPRESA" ? d.pilar_codigo : null,
          docs: [],
        })
      }
      g.get(clave)!.docs.push(d)
    })
    return [...g.values()]
  }, [visibles, ambito])

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface">
        <h1 className="text-lg sm:text-xl font-semibold text-ink">Mis documentos</h1>
        <p className="text-sm text-ink-muted mt-0.5">
          Tu biblioteca. Cada documento se sube una vez y vale para todos los clientes que lo exijan.
        </p>
      </div>

      <div className="px-6 sm:px-8 py-4 border-b border-line bg-surface flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-surface-sunken rounded-lg">
          {([
            { v: "EMPRESA" as const, label: "Empresa", icon: Building2, n: totalEmpresa },
            { v: "TRABAJADORES" as const, label: "Trabajadores", icon: Users, n: totalTrabajadores },
          ]).map(({ v, label, icon: Icon, n }) => (
            <button
              key={v}
              onClick={() => setAmbito(v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                ambito === v ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink-secondary"
              )}
            >
              <Icon size={13} /> {label}
              <span className="text-[10px] text-ink-subtle">{n}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar documento..."
            className="pl-8 pr-3 py-2 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="px-3 py-2 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="TODOS">Cualquier estado</option>
          <option value="FALTA">Falta subir</option>
          <option value="3">Observado</option>
          <option value="6">Requiere autorización</option>
          <option value="1">En revisión</option>
          <option value="4">Aprobado</option>
          <option value="5">Vencido</option>
        </select>

        {mandantes.length > 1 && (
          <select
            value={filtroMandante}
            onChange={e => setFiltroMandante(e.target.value)}
            className="px-3 py-2 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="TODOS">Todos los clientes</option>
            {mandantes.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 px-6 sm:px-8 py-6 space-y-5">
        {loading ? (
          <p className="text-sm text-ink-subtle py-14 text-center">Cargando documentos...</p>
        ) : grupos.length === 0 ? (
          <div className="py-14 text-center bg-surface rounded-xl border border-dashed border-line">
            <FileText size={26} className="text-ink-subtle mx-auto mb-3" />
            <p className="text-sm text-ink-muted">
              {docs.length === 0
                ? "Todavía no hay documentos exigidos"
                : "Ningún documento coincide con el filtro"}
            </p>
            {docs.length === 0 && (
              <p className="text-xs text-ink-subtle mt-1">
                Cuando un cliente cree un servicio para tu empresa, sus exigencias aparecerán aquí.
              </p>
            )}
          </div>
        ) : (
          grupos.map((g, i) => (
            <Grupo key={i} titulo={g.titulo} color={g.color} docs={g.docs}>
              {d => (
                <DocumentoRow
                  key={d.clave}
                  doc={d}
                  onSubir={setSubirDoc}
                  onHistorial={(doc, m) => setHistorial({ doc, m })}
                  onSensibilidad={setSensibilidadDoc}
                  onResolver={(d, m) => setSolicitud({ doc: d, m })}
                />
              )}
            </Grupo>
          ))
        )}
      </div>

      {historial?.m.documento_id && (
        <HistorialDialog
          documentoId={historial.m.documento_id}
          titulo={`${historial.doc.requisito_nombre} — ${historial.m.mandante_razon_social}`}
          estadoAcreditacion={historial.m.estado}
          onClose={() => setHistorial(null)}
        />
      )}

      {contratistaId && subirDoc && subirDoc.mandantes.length > 0 && (
        <SubirDocumentoDialog
          open
          onClose={() => setSubirDoc(null)}
          onSuccess={() => { setSubirDoc(null); cargar() }}
          requisito={{
            id: subirDoc.requisito_id,
            nombre: subirDoc.requisito_nombre,
            codigo: subirDoc.requisito_codigo,
            alcance: subirDoc.alcance,
            max_archivos: subirDoc.max_archivos,
            formatos_permitidos: subirDoc.formatos_permitidos,
            descripcion: subirDoc.requisito_descripcion,
          } satisfies RequisitoSubida}
          // La entrega es del expediente, no de un mandante: el backend la
          // propaga a todos los que la necesiten, sin mover al que ya aprobó una
          // versión vigente. Se manda el primero solo para resolver la
          // acreditación de referencia y validar el alcance.
          mandanteId={subirDoc.mandantes[0].mandante_id}
          empresaId={subirDoc.trabajador_id ? undefined : contratistaId}
          trabajadorId={subirDoc.trabajador_id ?? undefined}
          trabajadorNombre={subirDoc.trabajador_nombre ?? undefined}
          servicioFijo={
            subirDoc.servicio_id && subirDoc.servicio_nombre
              ? { id: subirDoc.servicio_id, nombre: subirDoc.servicio_nombre }
              : undefined
          }
        />
      )}

      {solicitud && (
        <ResolverSolicitudDialog
          mandante={solicitud.m}
          requisitoNombre={solicitud.doc.requisito_nombre}
          onClose={() => setSolicitud(null)}
          onResuelto={() => { setSolicitud(null); cargar() }}
        />
      )}

      {sensibilidadDoc && (
        <SensibilidadDialog
          doc={sensibilidadDoc}
          onClose={() => setSensibilidadDoc(null)}
          onDone={() => { setSensibilidadDoc(null); cargar() }}
        />
      )}
    </div>
  )
}
