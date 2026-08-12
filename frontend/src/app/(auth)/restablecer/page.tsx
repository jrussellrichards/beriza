"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { portalDe } from "@/shared/lib/auth"
import { MarcaAcredita } from "@/shared/ui/logo"

const LARGO_MINIMO = 8

interface TokenResponse {
  access_token: string
  rol: string
  mandante_id: string | null
  contratista_id: string | null
}

function Formulario() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [repetida, setRepetida] = useState("")
  const [ver, setVer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const corta = password.length > 0 && password.length < LARGO_MINIMO
  const noCoincide = repetida.length > 0 && password !== repetida
  const puedeEnviar =
    !!token && password.length >= LARGO_MINIMO && password === repetida && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await api.post<TokenResponse>("/api/v1/usuarios/restablecer", {
        token, password,
      })
      // El backend devuelve sesion iniciada: quien acaba de demostrar que
      // controla el email no tiene por que volver a tipear la clave recien
      // elegida en una pantalla de login.
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("rol", data.rol)
      router.push(portalDe(data.rol, data.mandante_id, data.contratista_id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restablecer la contraseña")
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-body text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line px-3.5 py-2.5 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-bloqueo-ink shrink-0" />
          Este enlace está incompleto. Pide uno nuevo.
        </div>
        <Link
          href="/recuperar"
          className="inline-flex items-center gap-1.5 text-body text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} /> Pedir un enlace nuevo
        </Link>
      </div>
    )
  }

  return (
    <>
      <div>
        <h2 className="text-title font-semibold text-ink">Elige tu contraseña</h2>
        <p className="text-body text-ink-muted mt-1">
          Al guardarla entras directamente a la plataforma.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-strong font-medium text-ink-secondary" htmlFor="password">
            Contraseña nueva
          </label>
          <div className="relative">
            <input
              id="password"
              type={ver ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 pr-10 text-body border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong transition-colors"
            />
            <button
              type="button"
              onClick={() => setVer(!ver)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink-muted transition-colors"
            >
              {ver ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className={cn("text-meta", corta ? "text-bloqueo-ink" : "text-ink-subtle")}>
            Al menos {LARGO_MINIMO} caracteres.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-strong font-medium text-ink-secondary" htmlFor="repetida">
            Repítela
          </label>
          <input
            id="repetida"
            type={ver ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            value={repetida}
            onChange={e => setRepetida(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 text-body border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong transition-colors"
          />
          {noCoincide && (
            <p className="text-meta text-bloqueo-ink">Las dos contraseñas no coinciden.</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-body text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line px-3.5 py-2.5 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-bloqueo-ink shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!puedeEnviar}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-strong font-semibold transition-all",
            !puedeEnviar
              ? "bg-line text-ink-subtle cursor-not-allowed"
              : "bg-surface-inverse text-ink-inverse hover:bg-surface-inverse-hover active:scale-[0.98]",
          )}
        >
          {loading ? "Guardando..." : <>Guardar y entrar <ArrowRight size={15} /></>}
        </button>
      </form>

      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-body text-ink-muted hover:text-ink transition-colors"
      >
        <ArrowLeft size={14} /> Volver a iniciar sesión
      </Link>
    </>
  )
}

export default function RestablecerPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-surface-app">
      <div className="w-full max-w-sm space-y-8">
        <MarcaAcredita />
        <Suspense fallback={<p className="text-body text-ink-subtle">Cargando...</p>}>
          <Formulario />
        </Suspense>
      </div>
    </div>
  )
}
