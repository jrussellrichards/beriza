"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Building2, Eye, EyeOff } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { MarcaAcredita } from "@/shared/ui/logo"

interface TokenResponse {
  access_token: string
  token_type: string
  rol: string
  mandante_id: string | null
  contratista_id: string | null
}

interface InvitacionInfo {
  email: string
  nombre: string
  /** ORGANIZACION: el invitado ES la empresa que se da de alta y confirma sus
   *  datos. EQUIPO: se suma a una que ya existe y solo elige su contraseña. */
  tipo: "ORGANIZACION" | "EQUIPO"
  organizacion: string
  razon_social: string
  rut: string
  giro: string | null
  mandante_razon_social: string
  rol: string
}

function ActivarForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [nombre, setNombre] = useState("")
  const [razonSocial, setRazonSocial] = useState("")
  const [rut, setRut] = useState("")
  const [giro, setGiro] = useState("")
  const [password, setPassword] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [invitacion, setInvitacion] = useState<InvitacionInfo | null>(null)
  const [cargandoInvitacion, setCargandoInvitacion] = useState(true)

  useEffect(() => {
    if (!token) {
      setCargandoInvitacion(false)
      return
    }
    api.get<InvitacionInfo>(`/api/v1/usuarios/invitacion/${token}`)
      .then((data) => {
        setInvitacion(data)
        setNombre(data.nombre)
        setRazonSocial(data.razon_social)
        setRut(data.rut)
        setGiro(data.giro ?? "")
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Invitación inválida o ya activada")
      })
      .finally(() => setCargandoInvitacion(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden")
      return
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }
    setLoading(true)
    setError(null)
    try {
      // Un miembro del equipo no manda datos de la empresa: no le corresponden.
      // El backend además los ignoraría, pero tampoco tiene sentido enviarlos.
      const data = await api.post<TokenResponse>("/api/v1/usuarios/activar", {
        token,
        password,
        ...(esEquipo
          ? { nombre }
          : { razon_social: razonSocial, rut, giro: giro || null }),
      })
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("rol", data.rol)
      // El destino sale del ROL, no de un literal: antes siempre mandaba a
      // /contratista, asi que un mandante recien activado caia en el portal
      // equivocado.
      router.push(
        data.rol === "mandante_admin" ? "/mandante"
        : data.rol === "berisa_admin" ? "/admin"
        : "/contratista",
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al activar la cuenta")
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-3 py-2.5 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong"

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm font-medium text-ink">Enlace de activación inválido</p>
        <p className="text-sm text-ink-muted">
          Falta el token de invitación. Usa el enlace exacto del email que recibiste,
          o pide al mandante que te invite nuevamente.
        </p>
      </div>
    )
  }

  if (cargandoInvitacion) {
    return <p className="text-sm text-ink-subtle text-center">Cargando invitación...</p>
  }

  if (!invitacion) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm font-medium text-ink">No pudimos cargar tu invitación</p>
        <p className="text-sm text-ink-muted">
          {error ?? "El enlace puede haber expirado o la cuenta ya fue activada."}
        </p>
      </div>
    )
  }

  const esEquipo = invitacion.tipo === "EQUIPO"
  // El giro es un dato del contratista; el modelo Mandante no lo tiene.
  const esMandante = invitacion.rol === "mandante_admin"

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* A un contratista lo invita un mandante; a un mandante lo invita BERISA
          y no hay un tercero que nombrar. */}
      <p className="text-sm text-ink-muted bg-surface-app border border-line rounded-lg px-3 py-2">
        {invitacion.mandante_razon_social
          ? <>Invitación de <span className="font-medium text-ink-secondary">{invitacion.mandante_razon_social}</span> para{" "}</>
          : <>Invitación de <span className="font-medium text-ink-secondary">BERISA</span> para{" "}</>}
        <span className="font-medium text-ink-secondary">{invitacion.email}</span>. Confirma o corrige los datos de tu empresa.
      </p>

      {esEquipo ? (
        // Un miembro del equipo solo confirma su propio nombre. Los datos de la
        // empresa NO se muestran: no le corresponde editarlos —podría cambiar el
        // RUT de su propia organización— y pedírselos era desconcertante, porque
        // veía la razón social de otra empresa como si fuera suya.
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-secondary">Tu nombre</label>
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Patricia Rojas"
            required
            className={inputCls}
          />
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-secondary">Razón social de tu empresa</label>
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                value={razonSocial}
                onChange={e => setRazonSocial(e.target.value)}
                placeholder="Constructora Ejemplo SpA"
                required
                className={cn(inputCls, "pl-9")}
              />
            </div>
          </div>

          <div className={cn("gap-3", esMandante ? "" : "grid grid-cols-2")}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink-secondary">RUT empresa</label>
              <input
                value={rut}
                onChange={e => setRut(e.target.value)}
                placeholder="76.123.456-7"
                required
                className={inputCls}
              />
            </div>
            {/* El giro es un dato del contratista; el modelo Mandante no lo tiene. */}
            {!esMandante && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink-secondary">Giro (opcional)</label>
                <input
                  value={giro}
                  onChange={e => setGiro(e.target.value)}
                  placeholder="Construcción"
                  className={inputCls}
                />
              </div>
            )}
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink-secondary">Contraseña</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
            className={cn(inputCls, "pr-10")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink-muted"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink-secondary">Confirmar contraseña</label>
        <input
          type={showPassword ? "text" : "password"}
          value={confirmar}
          onChange={e => setConfirmar(e.target.value)}
          required
          className={inputCls}
        />
      </div>

      {error && (
        <p className="text-sm text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className={cn(
          "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
          loading ? "bg-line text-ink-subtle cursor-not-allowed" : "bg-surface-inverse text-white hover:bg-surface-inverse-hover"
        )}
      >
        {loading ? "Activando..." : "Activar cuenta y comenzar"}
      </button>
    </form>
  )
}

export default function ActivarPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-app px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <MarcaAcredita />
        </div>

        <div className="bg-surface rounded-xl border border-line p-8">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-ink">Activa tu cuenta</h1>
            {/* El subtítulo específico lo pone el formulario, que sí sabe si es
                un alta de empresa o alguien sumándose a un equipo. */}
          </div>
          <Suspense fallback={<p className="text-sm text-ink-subtle">Cargando...</p>}>
            <ActivarForm />
          </Suspense>
        </div>

        <p className="text-xs text-ink-subtle text-center mt-6">
          ¿Ya tienes cuenta? <a href="/login" className="text-ink-muted font-medium hover:underline">Inicia sesión</a>
        </p>
      </div>
    </div>
  )
}
