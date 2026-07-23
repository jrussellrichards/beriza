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
        })
      } else {
        await api.post(`/api/v1/pilares/${pilar.id}/requisitos`, {
          codigo: codigo.toUpperCase().replace(/\s/g, "_"),
          nombre,
          descripcion: descripcion || null,
          entidad_tipo: entidad,
          alcance,
          max_archivos: maxArchivos,
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

  const inputCls = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {editando ? "Editar requisito" : contexto === "propio" ? "Nuevo requisito propio" : "Nuevo requisito"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Pilar: {pilar.nombre}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Código</label>
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            disabled={editando}
            placeholder="CERT_SEGURIDAD"
            className={cn(inputCls, "font-mono", editando && "bg-slate-50 text-slate-400 cursor-not-allowed")}
          />
          <p className="text-[10px] text-slate-400">
            {editando ? "El código no se puede cambiar — lo referencian expedientes y reglas." : "Identificador único. Se convierte a mayúsculas automáticamente."}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Nombre del requisito</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Certificado de seguridad" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Descripción</label>
          <textarea
            value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="Qué debe contener este documento y cuándo aplica..."
            rows={3}
            className={cn(inputCls, "resize-none")}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Entidad que lo presenta</label>
          <div className="grid grid-cols-2 gap-2">
            {(["EMPRESA", "TRABAJADOR"] as const).map(e => (
              <button
                key={e}
                onClick={() => !editando && setEntidad(e)}
                disabled={editando}
                className={cn(
                  "py-2 rounded-lg border text-sm font-medium transition-colors",
                  entidad === e ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300",
                  editando && "opacity-60 cursor-not-allowed"
                )}
              >
                {e === "EMPRESA" ? "Empresa" : "Trabajador"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Alcance</label>
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
                  alcance === o.v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">
            {alcance === "SERVICIO"
              ? "El contratista lo acredita por cada servicio/faena que lo exija (ej: MIPER)."
              : "El contratista lo acredita una vez y vale para todos sus servicios (ej: F30)."}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Archivos por entrega</label>
          <input
            type="number" min={1} max={20}
            value={maxArchivos}
            onChange={e => setMaxArchivos(Number(e.target.value))}
            className={cn(inputCls, "w-24")}
          />
          <p className="text-[10px] text-slate-400">Cuántos archivos admite una entrega (ej: contrato + anexos = 3).</p>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 flex items-start gap-2">
          <Lock size={11} className="mt-0.5 shrink-0" />
          {contexto === "propio"
            ? "Este requisito queda visible solo para tu organización — otros mandantes no lo verán."
            : "Este requisito queda en el catálogo global. Cada mandante decide en sus perfiles si lo exige y con qué parámetros."}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
      </div>

      <div className="px-6 py-4 border-t border-slate-100 shrink-0">
        <button
          onClick={handleGuardar}
          disabled={loading || !nombre || (!editando && !codigo)}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
            loading || !nombre || (!editando && !codigo)
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-slate-900 text-white hover:bg-slate-800"
          )}
        >
          {loading ? "Guardando..." : editando ? "Guardar cambios" : contexto === "propio" ? "Crear requisito propio" : "Agregar al catálogo"}
        </button>
      </div>
    </div>
  )
}
