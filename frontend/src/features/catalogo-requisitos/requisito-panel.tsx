"use client"

import { useState } from "react"
import { X, Lock } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"

export interface RequisitoCatalogo {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  entidad_tipo: "EMPRESA" | "TRABAJADOR"
  alcance: "ENTIDAD" | "SERVICIO"
  max_archivos: number
  sin_vencimiento?: boolean
  sensible?: boolean
}

interface PilarMinimo {
  id: string
  nombre: string
}

/**
 * Crea/edita un requisito documental. Mismo endpoint para catálogo global
 * (berisa_admin) y requisitos propios de un mandante (mandante_admin) --
 * el backend decide el alcance según el rol del usuario autenticado, nunca
 * el body. `contexto` solo cambia el copy del panel.
 */
export function RequisitoPanel({ pilar, requisito, contexto, onClose, onDone }: {
  pilar: PilarMinimo
  requisito: RequisitoCatalogo | null   // null = crear
  contexto: "global" | "propio"
  onClose: () => void
  onDone: () => void
}) {
  const editando = requisito !== null
  const [codigo, setCodigo] = useState(requisito?.codigo ?? "")
  const [nombre, setNombre] = useState(requisito?.nombre ?? "")
  const [descripcion, setDescripcion] = useState(requisito?.descripcion ?? "")
  const [entidad, setEntidad] = useState<"EMPRESA" | "TRABAJADOR">(requisito?.entidad_tipo ?? "EMPRESA")
  const [alcance, setAlcance] = useState<"ENTIDAD" | "SERVICIO">(requisito?.alcance ?? "ENTIDAD")
  const [maxArchivos, setMaxArchivos] = useState(requisito?.max_archivos ?? 1)
  const [sinVencimiento, setSinVencimiento] = useState(requisito?.sin_vencimiento ?? false)
  const [sensible, setSensible] = useState(requisito?.sensible ?? false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGuardar() {
    setLoading(true)
    setError(null)
    try {
      if (editando) {
        await api.patch(`/api/v1/pilares/requisitos/${requisito.id}`, {
          nombre,
          descripcion: descripcion || null,
          alcance,
          max_archivos: maxArchivos,
          sin_vencimiento: sinVencimiento,
          sensible,
        })
      } else {
        await api.post(`/api/v1/pilares/${pilar.id}/requisitos`, {
          codigo: codigo.toUpperCase().replace(/\s/g, "_"),
          nombre,
          descripcion: descripcion || null,
          entidad_tipo: entidad,
          alcance,
          max_archivos: maxArchivos,
          sin_vencimiento: sinVencimiento,
          sensible,
        })
      }
      onDone()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-3 py-2.5 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-line-subtle flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">
            {editando ? "Editar requisito" : contexto === "propio" ? "Nuevo requisito propio" : "Nuevo requisito"}
          </p>
          <p className="text-xs text-ink-subtle mt-0.5">Pilar: {pilar.nombre}</p>
        </div>
        <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-secondary">Código</label>
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            disabled={editando}
            placeholder="CERT_SEGURIDAD"
            className={cn(inputCls, "font-mono", editando && "bg-surface-app text-ink-subtle cursor-not-allowed")}
          />
          <p className="text-[10px] text-ink-subtle">
            {editando ? "El código no se puede cambiar — lo referencian expedientes y reglas." : "Identificador único. Se convierte a mayúsculas automáticamente."}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-secondary">Nombre del requisito</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Certificado de seguridad" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-secondary">Descripción</label>
          <textarea
            value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="Qué debe contener este documento y cuándo aplica..."
            rows={3}
            className={cn(inputCls, "resize-none")}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-secondary">Entidad que lo presenta</label>
          <div className="grid grid-cols-2 gap-2">
            {(["EMPRESA", "TRABAJADOR"] as const).map(e => (
              <button
                key={e}
                onClick={() => !editando && setEntidad(e)}
                disabled={editando}
                className={cn(
                  "py-2 rounded-lg border text-sm font-medium transition-colors",
                  entidad === e ? "border-ink bg-surface-inverse text-white" : "border-line text-ink-muted hover:border-line-strong",
                  editando && "opacity-60 cursor-not-allowed"
                )}
              >
                {e === "EMPRESA" ? "Empresa" : "Trabajador"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-secondary">Alcance</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: "ENTIDAD", label: "Se acredita una vez" },
              { v: "SERVICIO", label: "Por cada servicio" },
            ] as const).map(o => (
              <button
                key={o.v}
                onClick={() => setAlcance(o.v)}
                className={cn(
                  "py-2 rounded-lg border text-xs font-medium transition-colors",
                  alcance === o.v ? "border-ink bg-surface-inverse text-white" : "border-line text-ink-muted hover:border-line-strong"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-ink-subtle">
            {alcance === "SERVICIO"
              ? "El contratista lo acredita por cada servicio/faena que lo exija (ej: MIPER)."
              : "El contratista lo acredita una vez y vale para todos sus servicios (ej: F30)."}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-secondary">Archivos por entrega</label>
          <input
            type="number" min={1} max={20}
            value={maxArchivos}
            onChange={e => setMaxArchivos(Number(e.target.value))}
            className={cn(inputCls, "w-24")}
          />
          <p className="text-[10px] text-ink-subtle">Cuántos archivos admite una entrega (ej: contrato + anexos = 3).</p>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-line px-3 py-2.5">
          <input
            type="checkbox"
            checked={sinVencimiento}
            onChange={e => setSinVencimiento(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-ink-secondary">
            Sin vencimiento
            <span className="block text-[10px] text-ink-subtle">
              El documento no caduca; no genera alertas de vencimiento (ej: escritura de la sociedad).
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-line px-3 py-2.5">
          <input
            type="checkbox"
            checked={sensible}
            onChange={e => setSensible(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-ink-secondary">
            Contenido sensible
            <span className="block text-[10px] text-ink-subtle">
              No se comparte con un mandante nuevo sin autorización del contratista (ej: carpeta tributaria).
            </span>
          </span>
        </label>

        <div className="rounded-lg bg-accion-soft border border-accion-line px-3 py-2.5 text-xs text-accion-ink flex items-start gap-2">
          <Lock size={11} className="mt-0.5 shrink-0" />
          {contexto === "propio"
            ? "Este requisito queda visible solo para tu organización — otros mandantes no lo verán."
            : "Este requisito queda en el catálogo global. Cada mandante decide en sus perfiles si lo exige y con qué parámetros."}
        </div>

        {error && <p className="text-sm text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}
      </div>

      <div className="px-6 py-4 border-t border-line-subtle shrink-0">
        <button
          onClick={handleGuardar}
          disabled={loading || !nombre || (!editando && !codigo)}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
            loading || !nombre || (!editando && !codigo)
              ? "bg-line text-ink-subtle cursor-not-allowed"
              : "bg-surface-inverse text-white hover:bg-surface-inverse-hover"
          )}
        >
          {loading ? "Guardando..." : editando ? "Guardar cambios" : contexto === "propio" ? "Crear requisito propio" : "Agregar al catálogo"}
        </button>
      </div>
    </div>
  )
}
