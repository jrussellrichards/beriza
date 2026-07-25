"use client"

import { useEffect, useState } from "react"
import { UserPlus, Users } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { getSession } from "@/shared/lib/auth"
import { useApiData } from "@/shared/lib/use-api-data"
import { UsuarioPermisosDialog, type UsuarioEquipo } from "@/features/mandante/usuario-permisos-dialog"

const ROL_DEFAULT = { label: "Usuario", color: "bg-surface-app text-ink-muted border-line" }

const ROL_CFG: Record<string, { label: string; color: string }> = {
  mandante_admin: { label: "Aprueba todo", color: "bg-accion-soft text-accion-ink border-accion-line" },
  prevencionista: { label: "Revisor", color: "bg-brand-soft text-brand-hover border-brand-line" },
}

function iniciales(nombre: string) {
  return nombre.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

/**
 * Equipo del mandante: quién tiene acceso y qué pilares puede aprobar.
 *
 * Tiene URL propia y no es una subsección de Configuración. Invitar gente y
 * decidir quién aprueba qué es gestión recurrente con consecuencias reales —no
 * un "ajuste" que se toca una vez— y enterrado nadie lo encontraba.
 *
 * Un pathname distinto además evita depender del query string, que obligaba a
 * `useSearchParams` y rompía el prerender de Next.
 */
export default function EquipoPage() {
  const [mandanteId, setMandanteId] = useState<string | null>(null)
  const [dialogo, setDialogo] = useState<{ usuario: UsuarioEquipo | null } | null>(null)

  useEffect(() => {
    setMandanteId(getSession()?.mandante_id ?? null)
  }, [])

  const { data: equipo, loading, error, refetch } = useApiData<UsuarioEquipo[]>(
    mandanteId ? `/api/v1/mandantes/${mandanteId}/usuarios` : null, []
  )

  const sinPermisos = equipo.filter(u => u.pilares !== null && u.pilares.length === 0).length

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-semibold text-ink">Equipo</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            {equipo.length === 0
              ? "Invita a quienes revisarán la documentación de tus contratistas"
              : sinPermisos > 0
                ? `${sinPermisos} ${sinPermisos === 1 ? "persona" : "personas"} sin ningún pilar asignado: no puede${sinPermisos === 1 ? "" : "n"} aprobar nada`
                : `${equipo.length} ${equipo.length === 1 ? "persona" : "personas"} con acceso`}
          </p>
        </div>
        <button
          onClick={() => setDialogo({ usuario: null })}
          className="inline-flex items-center justify-center gap-2 bg-surface-inverse text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
        >
          <UserPlus size={14} />
          Invitar usuario
        </button>
      </div>

      <div className="flex-1 px-6 sm:px-8 py-6">
        {error && (
          <p className="text-sm text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line px-3 py-2 rounded-lg mb-4">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-ink-subtle py-14 text-center">Cargando equipo...</p>
        ) : equipo.length === 0 ? (
          <div className="py-14 text-center bg-surface rounded-xl border border-dashed border-line">
            <Users size={26} className="text-ink-subtle mx-auto mb-3" />
            <p className="text-sm text-ink-muted">Todavía no hay nadie más en tu equipo</p>
            <p className="text-xs text-ink-subtle mt-1">
              Puedes invitar a alguien y definir qué pilares podrá aprobar.
            </p>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-line divide-y divide-slate-100">
            {equipo.map(u => (
              <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4">
                <div className="w-8 h-8 rounded-full bg-surface-sunken text-ink-muted text-xs font-semibold flex items-center justify-center shrink-0">
                  {iniciales(u.nombre)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", u.activo ? "text-ink" : "text-ink-subtle")}>
                    {u.nombre}
                    {!u.activo && <span className="ml-2 text-[10px] text-ink-subtle">invitación pendiente</span>}
                  </p>
                  <p className="text-xs text-ink-subtle font-mono">{u.email}</p>
                  <p className={cn(
                    "text-[11px] mt-0.5",
                    u.pilares !== null && u.pilares.length === 0 ? "text-accion-ink" : "text-ink-muted"
                  )}>
                    {u.pilares === null
                      ? "Aprueba todos los pilares"
                      : u.pilares.length === 0
                        ? "No aprueba ningún pilar — solo puede revisar"
                        : `Aprueba: ${u.pilares.join(", ")}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border", (ROL_CFG[u.rol] ?? ROL_DEFAULT).color)}>
                    {(ROL_CFG[u.rol] ?? ROL_DEFAULT).label}
                  </span>
                  {u.pilares !== null && (
                    <button
                      onClick={() => setDialogo({ usuario: u })}
                      className="text-xs text-ink-muted hover:text-ink border border-line px-2.5 py-1 rounded-lg hover:bg-surface-app transition-colors"
                    >
                      Permisos
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dialogo && mandanteId && (
        <UsuarioPermisosDialog
          mandanteId={mandanteId}
          usuario={dialogo.usuario}
          onClose={() => setDialogo(null)}
          onGuardado={refetch}
        />
      )}
    </div>
  )
}
