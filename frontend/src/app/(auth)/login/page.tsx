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
      <div className="hidden lg:flex flex-col justify-between bg-[#0f172a] p-12">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <ShieldCheck size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-lg">Acredita</span>
        </div>

        {/* Tagline central */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Acreditación de contratistas,{" "}
              <span className="text-amber-400">sin papeles ni demoras.</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Automatiza la validación documental de tus empresas contratistas con IA. Reduce semanas de gestión a horas.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 pt-4 border-t border-white/10">
            {[
              { value: "90%", label: "menos tiempo en validación" },
              { value: "100%", label: "trazabilidad de documentos" },
              { value: "24/7", label: "auditoría automática con IA" },
            ].map(s => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-amber-400">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-600">
          © 2025 BERISA. Plataforma de acreditación para la industria de la construcción.
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex items-center justify-center p-8 bg-[#f8fafc]">
        <div className="w-full max-w-sm space-y-8">

          {/* Logo mobile */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
              <ShieldCheck size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-slate-900">Acredita</span>
          </div>

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Iniciar sesión</h2>
            <p className="text-sm text-slate-500 mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
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
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="password">
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
                  className="w-full px-3.5 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]"
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
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Credenciales de demo</p>
            {[
              { label: "BERISA Admin", email: "admin@berisa.cl", pass: "admin123" },
              { label: "Mandante", email: "mandante@demo.cl", pass: "demo123" },
              { label: "Contratista", email: "contratista@demo.cl", pass: "demo123" },
            ].map(c => (
              <button
                key={c.email}
                type="button"
                onClick={() => { setEmail(c.email); setPassword(c.pass) }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-slate-50 transition-colors group text-left"
              >
                <div>
                  <p className="text-xs font-medium text-slate-700">{c.label}</p>
                  <p className="text-xs text-slate-400 font-mono">{c.email}</p>
                </div>
                <ArrowRight size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
