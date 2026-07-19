"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Building2, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"

interface TokenResponse {
  access_token: string
  token_type: string
  rol: string
  mandante_id: string | null
  contratista_id: string | null
}

interface InvitacionInfo {
  email: string
  razon_social: string
  rut: string
  giro: string | null
  mandante_razon_social: string
}

function ActivarForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

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
      const data = await api.post<TokenResponse>("/api/v1/usuarios/activar", {
        token,
        password,
        razon_social: razonSocial,
        rut,
        giro: giro || null,
      })
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("rol", data.rol)
      router.push("/contratista")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al activar la cuenta")
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm font-medium text-slate-900">Enlace de activación inválido</p>
        <p className="text-sm text-slate-500">
          Falta el token de invitación. Usa el enlace exacto del email que recibiste,
          o pide al mandante que te invite nuevamente.
        </p>
      </div>
    )
  }

  if (cargandoInvitacion) {
    return <p className="text-sm text-slate-400 text-center">Cargando invitación...</p>
  }

  if (!invitacion) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm font-medium text-slate-900">No pudimos cargar tu invitación</p>
        <p className="text-sm text-slate-500">
          {error ?? "El enlace puede haber expirado o la cuenta ya fue activada."}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        Invitación de <span className="font-medium text-slate-700">{invitacion.mandante_razon_social}</span> para{" "}
        <span className="font-medium text-slate-700">{invitacion.email}</span>. Confirma o corrige los datos de tu empresa.
      </p>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Razón social de tu empresa</label>
        <div className="relative">
          <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={razonSocial}
            onChange={e => setRazonSocial(e.target.value)}
            placeholder="Constructora Ejemplo SpA"
            required
            className={cn(inputCls, "pl-9")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">RUT empresa</label>
          <input
            value={rut}
            onChange={e => setRut(e.target.value)}
            placeholder="76.123.456-7"
            required
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Giro (opcional)</label>
          <input
            value={giro}
            onChange={e => setGiro(e.target.value)}
            placeholder="Construcción"
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Contraseña</label>
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Confirmar contraseña</label>
        <input
          type={showPassword ? "text" : "password"}
          value={confirmar}
          onChange={e => setConfirmar(e.target.value)}
          required
          className={inputCls}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className={cn(
          "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
          loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"
        )}
      >
        {loading ? "Activando..." : "Activar cuenta y comenzar"}
      </button>
    </form>
  )
}

export default function ActivarPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <ShieldCheck size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-lg text-slate-900">Acredita</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-slate-900">Activa tu cuenta</h1>
            <p className="text-sm text-slate-500 mt-1">
              Confirma los datos de tu empresa y crea tu contraseña para comenzar a acreditarte.
            </p>
          </div>
          <Suspense fallback={<p className="text-sm text-slate-400">Cargando...</p>}>
            <ActivarForm />
          </Suspense>
        </div>

        <p className="text-xs text-slate-400 text-center mt-6">
          ¿Ya tienes cuenta? <a href="/login" className="text-slate-600 font-medium hover:underline">Inicia sesión</a>
        </p>
      </div>
    </div>
  )
}
