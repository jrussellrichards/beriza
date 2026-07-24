"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Lock, ShieldQuestion, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { formatFecha } from "@/entities/documento/exigencia"

interface Solicitud {
  acreditacion_id: string
  mandante_razon_social: string
  requisito_codigo: string
  requisito_nombre: string
  pilar_nombre: string
  trabajador_nombre: string | null
  numero_version_vigente: number | null
  fecha_vigencia_hasta: string | null
  solicitado_en: string
}

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(true)
  const [resolviendo, setResolviendo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    api.get<Solicitud[]>("/api/v1/reutilizacion/solicitudes")
      .then(setSolicitudes)
      .catch(() => setSolicitudes([]))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function resolver(id: string, accion: "autorizar" | "rechazar") {
    setResolviendo(id)
    setError(null)
    try {
      await api.post(`/api/v1/reutilizacion/solicitudes/${id}/${accion}`, {})
      setSolicitudes(prev => prev.filter(s => s.acreditacion_id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo resolver la solicitud")
    } finally {
      setResolviendo(null)
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <h1 className="text-xl font-semibold text-slate-900">Solicitudes de acceso</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Documentos marcados como sensibles que un mandante quiere revisar. Nada se comparte hasta que autorices.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
        )}

        {!cargando && solicitudes.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl py-14 text-center">
            <ShieldQuestion size={22} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-500 mt-3">No tienes solicitudes pendientes</p>
            <p className="text-xs text-slate-400 mt-1">
              Tus documentos no sensibles se aplican automáticamente a cada mandante nuevo.
            </p>
          </div>
        )}

        {solicitudes.map(s => {
          const ocupado = resolviendo === s.acreditacion_id
          return (
            <div key={s.acreditacion_id} className="bg-white border border-slate-200 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border border-violet-200 bg-violet-50 text-violet-700">
                      <Lock size={9} />
                      Sensible
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{s.pilar_nombre}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 mt-2">
                    {s.requisito_nombre}
                    <span className="ml-2 text-[10px] font-mono text-slate-400">{s.requisito_codigo}</span>
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    <strong className="font-medium text-slate-900">{s.mandante_razon_social}</strong> solicita revisar
                    {s.trabajador_nombre ? ` este documento de ${s.trabajador_nombre}` : " este documento de tu empresa"}.
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Se compartiría la versión {s.numero_version_vigente ?? "—"}
                    {s.fecha_vigencia_hasta ? ` · vigente hasta ${formatFecha(s.fecha_vigencia_hasta)}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => resolver(s.acreditacion_id, "rechazar")}
                    disabled={ocupado}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                      ocupado
                        ? "border-slate-200 text-slate-300 cursor-not-allowed"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <X size={14} />
                    Rechazar
                  </button>
                  <button
                    onClick={() => resolver(s.acreditacion_id, "autorizar")}
                    disabled={ocupado}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      ocupado ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                  >
                    <Check size={14} />
                    Autorizar
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
                Si rechazas, el requisito quedará como brecha con este mandante hasta que subas el documento manualmente.
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
