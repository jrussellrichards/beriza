"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Eye, EyeOff, ArrowRight } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"

interface TokenResponse {
  access_token: string
  token_type: string
  rol: string
  mandante_id: string | null
  contratista_id: string | null
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await api.post<TokenResponse>("/api/v1/usuarios/login", { email, password })
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("rol", data.rol)
      if (data.rol === "berisa_admin") router.push("/admin")
      else if (data.rol === "mandante_admin") router.push("/mandante")
      else router.push("/contratista")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credenciales incorrectas")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">

      {/* Panel izquierdo — marca */}
      <div className="hidden lg:flex flex-col justify-between bg-surface-inverse p-12">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-mark rounded-lg flex items-center justify-center">
            <ShieldCheck size={16} className="text-ink-inverse" strokeWidth={2.5} />
          </div>
          <span className="text-ink-inverse font-semibold text-lg">Acredita</span>
        </div>

        {/*
          Nadie llega acá sin haber sido invitado: no es una superficie de venta,
          es orientación. Se retiraron las tres cifras que había (90% / 100% /
          24-7) por dos razones. "24/7 auditoría automática con IA" era falso —el
          pipeline no existe— y afirmarlo ante el usuario cuyo trabajo es confiar
          en lo que el sistema declara es un riesgo comercial, no un problema de
          redacción. Y las otras dos eran porcentajes sin línea base ni fuente,
          justo el tipo de cifra que un prevencionista está entrenado para
          desconfiar. Quedan hechos verificables.
        */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold text-ink-inverse leading-tight">
              Saber exactamente quién puede entrar a faena.
            </h1>
            <p className="text-ink-inverse-muted text-body leading-relaxed max-w-md">
              Acredita la documentación de tus empresas contratistas y deja registro
              de qué se verificó, con qué documento y cuándo.
            </p>
          </div>

          <ul className="space-y-3 pt-4 border-t border-line-inverse">
            {[
              "Cada aprobación queda con nombre, hora y el documento que la respaldó.",
              "Un documento se sube una vez y sirve para todos los mandantes que lo exijan.",
              "Nadie queda bloqueado sin saber exactamente qué falta.",
            ].map(t => (
              <li key={t} className="flex items-start gap-2.5 text-meta text-ink-inverse-muted">
                <span className="w-1 h-1 rounded-full bg-brand-on-dark mt-2 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs text-ink-muted">
          © 2025 BERISA. Plataforma de acreditación para la industria de la construcción.
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex items-center justify-center p-8 bg-surface-app">
        <div className="w-full max-w-sm space-y-8">

          {/* Logo mobile */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-7 h-7 bg-brand-mark rounded-lg flex items-center justify-center">
              <ShieldCheck size={14} className="text-ink-inverse" strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-ink">Acredita</span>
          </div>

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-ink">Iniciar sesión</h2>
            <p className="text-sm text-ink-muted mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink-secondary" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@empresa.cl"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-sm border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink-secondary" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 pr-10 text-sm border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink-muted transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-3.5 py-2.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all",
                loading || !email || !password
                  ? "bg-slate-200 text-ink-subtle cursor-not-allowed"
                  : "bg-slate-900 text-ink-inverse hover:bg-slate-800 active:scale-[0.98]"
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : (
                <>
                  Ingresar
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Credenciales demo */}
          <div className="rounded-lg border border-line bg-surface p-4 space-y-3">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Credenciales de demo</p>
            {[
              { label: "BERISA Admin", email: "admin@berisa.cl", pass: "admin123" },
              { label: "Mandante", email: "mandante@demo.cl", pass: "demo123" },
              { label: "Contratista", email: "contratista@demo.cl", pass: "demo123" },
            ].map(c => (
              <button
                key={c.email}
                type="button"
                onClick={() => { setEmail(c.email); setPassword(c.pass) }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-surface-app transition-colors group text-left"
              >
                <div>
                  <p className="text-xs font-medium text-ink-secondary">{c.label}</p>
                  <p className="text-xs text-ink-subtle font-mono">{c.email}</p>
                </div>
                <ArrowRight size={12} className="text-ink-subtle group-hover:text-ink-muted transition-colors" />
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
