"use client"

import { useEffect, useState } from "react"
import { UserPlus, Users } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { getSession } from "@/shared/lib/auth"
import { useApiData } from "@/shared/lib/use-api-data"
import { UsuarioPermisosDialog, type UsuarioEquipo } from "@/features/mandante/usuario-permisos-dialog"
import { CuentaDialog } from "@/features/equipo/cuenta-dialog"

/**
 * Lo que un mandante_admin puede otorgar. El backend lo revalida en
 * usuario_service.ROLES_QUE_PUEDE_OTORGAR: acá es solo lo que se ofrece.
 */
const ROLES_MANDANTE = [
  { v: "prevencionista", label: "Revisor", ayuda: "Revisa y aprueba según su alcance por pilar" },
  { v: "mandante_admin", label: "Administrador", ayuda: "Además invita gente y configura los perfiles" },
]

/**
 * Etiqueta del perfil: cruce de las dos preguntas independientes —qué aprueba y
 * si administra la cuenta—. Antes decía "Aprueba todo" para un mandante_admin,
 * que era cierto pero ocultaba lo importante: que además administra.
 */
function perfilDe(u: UsuarioEquipo): { label: string; color: string } {
  if (u.rol === "mandante_admin") {
    return { label: "Administrador", color: "bg-accion-soft text-accion-ink border-accion-line" }
  }
  if (u.aprueba_todo) {
    return { label: "Revisor senior", color: "bg-brand-soft text-brand-hover border-brand-line" }
  }
  if (u.pilar_ids.length > 0) {
    return { label: "Revisor", color: "bg-surface-app text-ink-muted border-line" }
  }
  return { label: "Observador", color: "bg-espera-soft text-espera-ink border-espera-line" }
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
  const [cuenta, setCuenta] = useState<UsuarioEquipo | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)


  useEffect(() => {
    setMandanteId(getSession()?.mandante_id ?? null)
  }, [])

  const { data: equipo, loading, error, refetch } = useApiData<UsuarioEquipo[]>(
    mandanteId ? `/api/v1/mandantes/${mandanteId}/usuarios` : null, []
  )

  // Sólo las cuentas que hoy pueden entrar. Contar todo el equipo hacía que
  // revocarle el acceso a alguien no moviera el número.
  const conAcceso = equipo.filter(u => u.activo).length
  const sinPermisos = equipo.filter(u => u.pilares !== null && u.pilares.length === 0).length

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-title sm:text-title font-semibold text-ink">Equipo</h1>
          <p className="text-body text-ink-muted mt-0.5">
            {equipo.length === 0
              ? "Invita a quienes revisarán la documentación de tus contratistas"
              : sinPermisos > 0
                ? `${sinPermisos} ${sinPermisos === 1 ? "persona" : "personas"} sin ningún pilar asignado: no puede${sinPermisos === 1 ? "" : "n"} aprobar nada`
                : `${conAcceso} ${conAcceso === 1 ? "persona" : "personas"} con acceso`}
          </p>
        </div>
        <button
          onClick={() => setDialogo({ usuario: null })}
          className="inline-flex items-center justify-center gap-2 bg-surface-inverse text-white text-strong font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
        >
          <UserPlus size={14} />
          Invitar usuario
        </button>
      </div>

      <div className="flex-1 px-6 sm:px-8 py-6">
        {aviso && (
          <p className="text-body text-ok-ink bg-ok-soft border border-ok-line px-3 py-2 rounded-lg mb-4">{aviso}</p>
        )}
        {(error || errorAccion) && (
          <p className="text-body text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line px-3 py-2 rounded-lg mb-4">{error || errorAccion}</p>
        )}

        {loading ? (
          <p className="text-body text-ink-subtle py-14 text-center">Cargando equipo...</p>
        ) : equipo.length === 0 ? (
          <div className="py-14 text-center bg-surface rounded-xl border border-dashed border-line">
            <Users size={26} className="text-ink-subtle mx-auto mb-3" />
            <p className="text-body text-ink-muted">Todavía no hay nadie más en tu equipo</p>
            <p className="text-meta text-ink-subtle mt-1">
              Puedes invitar a alguien y definir qué pilares podrá aprobar.
            </p>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-line divide-y divide-line">
            {equipo.map(u => (
              <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4">
                <div className="w-8 h-8 rounded-full bg-surface-sunken text-ink-muted text-micro font-semibold flex items-center justify-center shrink-0">
                  {iniciales(u.nombre)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn("text-strong font-medium", u.activo ? "text-ink" : "text-ink-subtle")}>
                    {u.nombre}
                    {!u.activo && (
                      // "invitación pendiente" y "sin acceso" son estados opuestos y
                      // ambos tienen activo=false. Rotular de la primera forma a quien
                      // activó su cuenta y luego se la revocaron decía lo contrario de
                      // lo que había pasado. El backend ya distingue con `pendiente`.
                      <span className="ml-2 text-[10px] text-ink-subtle">
                        {u.pendiente ? "invitación pendiente" : "sin acceso"}
                      </span>
                    )}
                  </p>
                  <p className="text-meta text-ink-subtle font-mono">{u.email}</p>
                  {u.cargo && <p className="text-[11px] text-ink-muted mt-0.5">{u.cargo}</p>}
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
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border", perfilDe(u).color)}>
                    {perfilDe(u).label}
                  </span>
                  {/* Se compara el ROL, no `pilares !== null`: un revisor senior
                      también tiene pilares null, y con la condición anterior
                      perdía el botón —dejando su alcance total irreversible—.
                      A un administrador sí no aplica: su alcance sale del rol. */}
                  {u.rol !== "mandante_admin" && (
                    <button
                      onClick={() => setDialogo({ usuario: u })}
                      className="text-meta text-ink-muted hover:text-ink border border-line px-2.5 py-1 rounded-lg hover:bg-surface-app transition-colors"
                    >
                      Permisos
                    </button>
                  )}
                  {/* Sobre uno mismo no se ofrece nada: el backend rechaza
                      desactivarse y cambiarse el rol, y un botón que siempre
                      falla es peor que no tenerlo. */}
                  {!u.es_uno_mismo && (
                    <button
                      onClick={() => setCuenta(u)}
                      className="text-meta text-ink-muted hover:text-ink border border-line px-2.5 py-1 rounded-lg hover:bg-surface-app transition-colors"
                    >
                      Cuenta
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cuenta && (
        <CuentaDialog
          cuenta={{ ...cuenta, pendiente: cuenta.pendiente ?? false }}
          roles={ROLES_MANDANTE}
          onClose={() => setCuenta(null)}
          onCambio={() => { setCuenta(null); refetch() }}
          onAviso={setAviso}
          onError={setErrorAccion}
        />
      )}

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
