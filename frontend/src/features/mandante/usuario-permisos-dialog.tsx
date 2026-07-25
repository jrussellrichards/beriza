"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"

interface PilarCatalogo {
  id: string
  codigo: string
  nombre: string
}

export interface UsuarioEquipo {
  id: string
  nombre: string
  email: string
  rol: string
  activo: boolean
  /** null = aprueba todos los pilares. Lista vacía = ninguno. */
  pilares: string[] | null
  pilar_ids: string[]
}

/**
 * Invita a alguien del equipo del mandante, o cambia qué pilares puede aprobar.
 *
 * La granularidad es el pilar y no el documento porque así se organiza un
 * mandante: el prevencionista aprueba HSE, finanzas aprueba Compliance. Por
 * documento serían cientos de casillas que nadie mantendría.
 *
 * Solo se restringe APROBAR: ver queda abierto dentro de la organización.
 */
export function UsuarioPermisosDialog({ mandanteId, usuario, onClose, onGuardado }: {
  mandanteId: string
  /** null = invitar a alguien nuevo */
  usuario: UsuarioEquipo | null
  onClose: () => void
  onGuardado: () => void
}) {
  const editando = usuario !== null
  const [pilares, setPilares] = useState<PilarCatalogo[]>([])
  const [email, setEmail] = useState("")
  const [nombre, setNombre] = useState("")
  const [rol, setRol] = useState<"prevencionista" | "mandante_admin">(
    (usuario?.rol as "prevencionista" | "mandante_admin") ?? "prevencionista"
  )
  const [elegidos, setElegidos] = useState<string[]>(usuario?.pilar_ids ?? [])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkRespaldo, setLinkRespaldo] = useState<string | null>(null)

  useEffect(() => {
    api.get<PilarCatalogo[]>("/api/v1/pilares/")
      .then(p => setPilares(p.map(x => ({ id: x.id, codigo: x.codigo, nombre: x.nombre }))))
      .catch(() => setPilares([]))
  }, [])

  const apruebaTodo = rol === "mandante_admin"

  function alternar(id: string) {
    setElegidos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    setLinkRespaldo(null)
    try {
      if (editando) {
        await api.put(`/api/v1/mandantes/${mandanteId}/usuarios/${usuario.id}/permisos`, {
          pilar_ids: elegidos,
        })
        onGuardado()
        onClose()
        return
      }
      const r = await api.post<{ mensaje: string; link_activacion?: string }>(
        `/api/v1/mandantes/${mandanteId}/invitar-usuario`,
        { email, nombre, rol, pilar_ids: apruebaTodo ? [] : elegidos },
      )
      onGuardado()
      if (r.link_activacion) {
        setLinkRespaldo(r.link_activacion)
        return
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setGuardando(false)
    }
  }

  const inputCls = "w-full px-3 py-2.5 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-slate-900/10"
  const puedeGuardar = editando ? true : Boolean(email && nombre)

  return (
    <div className="fixed inset-0 bg-surface-inverse/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-line-subtle flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">
              {editando ? "Permisos de aprobación" : "Invitar a tu equipo"}
            </p>
            <p className="text-xs text-ink-subtle mt-0.5">
              {editando ? usuario.nombre : "Se le enviará un email para activar su cuenta"}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!editando && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink-secondary">Nombre</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                       placeholder="Patricia Rojas" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink-secondary">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                       placeholder="patricia@empresa.cl" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink-secondary">Qué puede aprobar</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: "prevencionista" as const, label: "Solo algunos pilares" },
                    { v: "mandante_admin" as const, label: "Todo" },
                  ]).map(o => (
                    <button
                      key={o.v}
                      onClick={() => setRol(o.v)}
                      className={cn(
                        "py-2 rounded-lg border text-xs font-medium transition-colors",
                        rol === o.v ? "border-ink bg-surface-inverse text-white"
                                    : "border-line text-ink-muted hover:border-line-strong"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {apruebaTodo && (
                  <p className="text-[10px] text-accion-ink bg-accion-soft border border-accion-line rounded px-2 py-1.5">
                    También podrá configurar los perfiles de exigencias, invitar contratistas
                    y otorgar excepciones.
                  </p>
                )}
              </div>
            </>
          )}

          {!apruebaTodo && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink-secondary flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-ink-subtle" />
                Pilares que puede aprobar
              </label>
              <div className="space-y-1.5">
                {pilares.map(p => (
                  <label key={p.id}
                         className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-line px-3 py-2 hover:border-line-strong">
                    <input type="checkbox" checked={elegidos.includes(p.id)}
                           onChange={() => alternar(p.id)} />
                    <span className="text-sm text-ink-secondary">{p.nombre}</span>
                  </label>
                ))}
                {pilares.length === 0 && (
                  <p className="text-xs text-ink-subtle">No hay pilares en el catálogo.</p>
                )}
              </div>
              <p className="text-[10px] text-ink-subtle">
                Podrá <strong>ver</strong> todos los documentos —ocultarlos entre colegas solo
                confunde— pero solo <strong>aprobar</strong> los de estos pilares.
              </p>
              {elegidos.length === 0 && (
                <p className="text-[10px] text-accion-ink">
                  Sin ningún pilar asignado no podrá aprobar nada, solo revisar.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-bloqueo-ink bg-bloqueo-soft px-3 py-2 rounded-md">{error}</p>}

          {linkRespaldo && (
            <div className="rounded-lg bg-accion-soft border border-accion-line p-3 space-y-2">
              <p className="text-xs text-accion-ink">
                El usuario se creó pero el email no pudo enviarse. Entrégale este enlace:
              </p>
              <code className="block text-[10px] bg-surface border border-accion-line rounded px-2 py-1.5 break-all text-ink-secondary">
                {linkRespaldo}
              </code>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line-subtle">
          <button
            onClick={guardar}
            disabled={!puedeGuardar || guardando}
            className={cn(
              "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
              !puedeGuardar || guardando
                ? "bg-line text-ink-subtle cursor-not-allowed"
                : "bg-surface-inverse text-white hover:bg-surface-inverse-hover"
            )}
          >
            {guardando ? "Guardando..." : editando ? "Guardar permisos" : "Enviar invitación"}
          </button>
        </div>
      </div>
    </div>
  )
}
