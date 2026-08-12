"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { MarcaAcredita } from "@/shared/ui/logo"

export default function RecuperarPage() {
  const [email, setEmail] = useState("")
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post("/api/v1/usuarios/recuperar", { email })
      // El backend responde lo mismo exista o no la cuenta, asi que la pantalla
      // tampoco puede distinguirlas: mostrar "no existe ese correo" convertiria
      // este formulario en una forma de averiguar quien esta registrado.
      setEnviado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la solicitud")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-surface-app">
      <div className="w-full max-w-sm space-y-8">
        <MarcaAcredita />

        {enviado ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 bg-brand-soft border border-brand-line rounded-lg px-4 py-3.5">
              <MailCheck size={16} className="text-brand mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-strong font-medium text-ink">Revisa tu correo</p>
                <p className="text-meta text-brand-hover leading-relaxed">
                  Si hay una cuenta activa con <strong>{email}</strong>, te llegó un enlace
                  para elegir una contraseña nueva. Vence en una hora y sirve una sola vez.
                </p>
              </div>
            </div>
            <p className="text-meta text-ink-subtle leading-relaxed">
              ¿No llegó? Puede que la cuenta esté desactivada o que todavía no hayas
              aceptado la invitación. En ese caso escríbele a un administrador de tu
              organización.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-body text-ink-muted hover:text-ink transition-colors"
            >
              <ArrowLeft size={14} /> Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-title font-semibold text-ink">Recuperar contraseña</h2>
              <p className="text-body text-ink-muted mt-1">
                Te enviamos un enlace para elegir una nueva.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-strong font-medium text-ink-secondary" htmlFor="email">
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
                  className="w-full px-3.5 py-2.5 text-body border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-line-strong transition-colors"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-body text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line px-3.5 py-2.5 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-bloqueo-ink shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-strong font-semibold transition-all",
                  loading || !email
                    ? "bg-line text-ink-subtle cursor-not-allowed"
                    : "bg-surface-inverse text-ink-inverse hover:bg-surface-inverse-hover active:scale-[0.98]",
                )}
              >
                {loading ? "Enviando..." : <>Enviar enlace <ArrowRight size={15} /></>}
              </button>
            </form>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-body text-ink-muted hover:text-ink transition-colors"
            >
              <ArrowLeft size={14} /> Volver a iniciar sesión
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
