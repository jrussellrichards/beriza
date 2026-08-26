"use client"

import { useEffect, useState } from "react"
import { Pencil, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"

/** Lo que devuelve GET /servicios/{id} — incluye descripcion, que el listado no trae. */
interface ServicioDetalle {
  id: string
  nombre: string
  codigo_referencia: string | null
  descripcion: string | null
  fecha_inicio: string
  fecha_termino: string | null
}

/**
 * Edita los datos descriptivos de un servicio.
 *
 * El endpoint existía desde antes y estaba probado; lo único que faltaba era
 * una forma de llegarle. El front solo lo usaba para asignar centro de trabajo,
 * así que un servicio creado con el nombre equivocado se quedaba así para
 * siempre.
 *
 * NO deja cambiar contratista ni perfil de requisitos, igual que el backend:
 * cambiar el contratista es otro servicio, y cambiar el perfil altera en
 * silencio qué documentos se exigen y podría deshabilitar trabajadores sin que
 * nadie toque un documento.
 *
 * Carga el detalle al abrir en vez de recibirlo por props porque el listado no
 * trae `descripcion`, y editarla sin verla la borraría.
 */
export function EditarServicioDialog({ servicioId, onClose, onGuardado }: {
  servicioId: string
  onClose: () => void
  onGuardado: () => void
}) {
  const [detalle, setDetalle] = useState<ServicioDetalle | null>(null)
  const [nombre, setNombre] = useState("")
  const [codigo, setCodigo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [fechaTermino, setFechaTermino] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    api.get<ServicioDetalle>(`/api/v1/servicios/${servicioId}`)
      .then(d => {
        if (!vigente) return
        setDetalle(d)
        setNombre(d.nombre)
        setCodigo(d.codigo_referencia ?? "")
        setDescripcion(d.descripcion ?? "")
        setFechaTermino(d.fecha_termino ?? "")
      })
      .catch(e => vigente && setError(e instanceof Error ? e.message : "No se pudo cargar el servicio"))
    return () => { vigente = false }
  }, [servicioId])

  // Solo viajan los campos que cambiaron. El backend hace edición parcial:
  // lo que no se manda queda como está.
  function cambios() {
    if (!detalle) return {}
    const c: Record<string, string> = {}
    if (nombre.trim() !== detalle.nombre) c.nombre = nombre.trim()
    if (codigo.trim() !== (detalle.codigo_referencia ?? "")) c.codigo_referencia = codigo.trim()
    if (descripcion.trim() !== (detalle.descripcion ?? "")) c.descripcion = descripcion.trim()
    if (fechaTermino && fechaTermino !== (detalle.fecha_termino ?? "")) c.fecha_termino = fechaTermino
    return c
  }

  const pendientes = cambios()
  const hayCambios = Object.keys(pendientes).length > 0
  const nombreVacio = nombre.trim() === ""
  // El backend rechaza una fecha de término anterior al inicio; avisar acá
  // evita un viaje al servidor para escuchar lo que ya sabemos.
  const fechaInvalida = !!(detalle && fechaTermino && fechaTermino < detalle.fecha_inicio)

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await api.patch(`/api/v1/servicios/${servicioId}`, pendientes)
      onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setGuardando(false)
    }
  }

  const inputCls = "w-full px-3 py-2.5 text-body border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20"

  return (
    <div className="fixed inset-0 bg-surface-inverse/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-line-subtle flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-strong font-semibold text-ink">Editar servicio</p>
            <p className="text-meta text-ink-subtle mt-0.5 truncate">
              {detalle?.nombre ?? "Cargando..."}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted shrink-0"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!detalle && !error && (
            <p className="text-meta text-ink-subtle">Cargando datos del servicio...</p>
          )}

          {detalle && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="ed-nombre" className="text-strong font-medium text-ink-secondary block">
                  Nombre
                </label>
                <input
                  id="ed-nombre"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className={inputCls}
                  placeholder="Montaje estructuras área seca"
                />
                {nombreVacio && (
                  <p className="text-[11px] text-bloqueo-ink">El servicio necesita un nombre.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ed-codigo" className="text-strong font-medium text-ink-secondary block">
                  Código de referencia <span className="text-ink-subtle font-normal">— opcional</span>
                </label>
                <input
                  id="ed-codigo"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  className={inputCls}
                  placeholder="N° de contrato u orden de compra"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ed-descripcion" className="text-strong font-medium text-ink-secondary block">
                  Descripción <span className="text-ink-subtle font-normal">— opcional</span>
                </label>
                <textarea
                  id="ed-descripcion"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  rows={3}
                  className={cn(inputCls, "resize-none")}
                  placeholder="Qué comprende el servicio"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ed-fecha-termino" className="text-strong font-medium text-ink-secondary block">
                  Fecha de término <span className="text-ink-subtle font-normal">— opcional</span>
                </label>
                <input
                  id="ed-fecha-termino"
                  type="date"
                  value={fechaTermino}
                  min={detalle.fecha_inicio}
                  onChange={e => setFechaTermino(e.target.value)}
                  className={inputCls}
                />
                <p className="text-[10px] text-ink-subtle">
                  Inicio: {detalle.fecha_inicio}
                  {detalle.fecha_termino && " · una vez puesta, la fecha se puede corregir pero no dejar vacía"}
                </p>
                {fechaInvalida && (
                  <p className="text-[11px] text-bloqueo-ink">
                    La fecha de término no puede ser anterior al inicio.
                  </p>
                )}
              </div>
            </>
          )}

          {error && <p className="text-body text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-line-subtle">
          <button
            onClick={guardar}
            disabled={!detalle || !hayCambios || nombreVacio || fechaInvalida || guardando}
            className={cn(
              "w-full py-2.5 rounded-lg text-strong font-medium transition-all inline-flex items-center justify-center gap-2",
              !detalle || !hayCambios || nombreVacio || fechaInvalida || guardando
                ? "bg-line text-ink-subtle cursor-not-allowed"
                : "bg-surface-inverse text-white hover:bg-surface-inverse-hover",
            )}
          >
            <Pencil size={14} />
            {guardando ? "Guardando..." : hayCambios ? "Guardar cambios" : "Sin cambios"}
          </button>
        </div>
      </div>
    </div>
  )
}
