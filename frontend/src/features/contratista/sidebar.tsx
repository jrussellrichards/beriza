"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { Briefcase, FileText, Users, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react"

const nav = [
  { href: "/contratista", label: "Inicio", icon: LayoutDashboard },
  { href: "/contratista/servicios", label: "Servicios", icon: Briefcase },
  { href: "/contratista/trabajadores", label: "Trabajadores", icon: Users },
  { href: "/contratista/documentos", label: "Documentos", icon: FileText },
]

function esActivo(path: string, href: string) {
  return path === href || (href !== "/contratista" && path.startsWith(href))
}

/**
 * Navegación del contratista: barra lateral en escritorio, barra inferior en
 * teléfono.
 *
 * El prevencionista que sube un examen médico está en la obra con el teléfono,
 * no en un escritorio — con un sidebar fijo de 224px el portal era inutilizable
 * ahí. Cuatro secciones caben cómodas en una barra inferior.
 */
export function SidebarContratista() {
  const path = usePathname()
  // Contador de TODO lo que espera una acción suya, no solo de las solicitudes
  // de acceso: es la bandeja unificada que vive en Inicio.
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => {
    api.get<unknown[]>("/api/v1/acreditacion/mis-pendientes")
      .then(s => setPendientes(s.length))
      .catch(() => setPendientes(0))
  }, [path])

  return (
    <>
      {/* Escritorio */}
      <aside className="hidden md:flex w-56 min-h-screen bg-surface-inverse flex-col shrink-0">
        <div className="px-4 py-5 border-b border-line-inverse">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand-mark rounded-lg flex items-center justify-center shrink-0">
              <ShieldCheck size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Acredita</p>
              <p className="text-[10px] text-ink-muted mt-0.5">Portal Contratista</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = esActivo(path, href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-white/[0.06] text-ink-inverse font-medium border-l-2 border-brand-on-dark pl-[10px]"
                    : "text-ink-inverse-muted hover:text-ink-inverse hover:bg-white/5"
                )}
              >
                <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                {label}
                {href === "/contratista" && pendientes > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-accion-line text-accion-ink text-[10px] font-semibold flex items-center justify-center">
                    {pendientes}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-line-inverse">
          <button
            onClick={() => { localStorage.clear(); window.location.href = "/login" }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-ink-inverse-muted hover:text-ink-inverse hover:bg-white/5 w-full transition-colors"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Teléfono: cabecera + barra inferior */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-surface-inverse px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-brand-mark rounded-md flex items-center justify-center">
            <ShieldCheck size={12} className="text-white" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-semibold text-white">Acredita</p>
        </div>
        <button
          onClick={() => { localStorage.clear(); window.location.href = "/login" }}
          className="text-ink-inverse-muted p-1"
          aria-label="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </header>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-inverse border-t border-white/10 grid grid-cols-4">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = esActivo(path, href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors",
                active ? "text-brand-on-dark font-medium" : "text-ink-inverse-muted"
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              {label}
              {href === "/contratista" && pendientes > 0 && (
                <span className="absolute top-1.5 right-1/2 translate-x-4 min-w-[16px] h-[16px] px-1 rounded-full bg-accion-line text-accion-ink text-[9px] font-semibold flex items-center justify-center">
                  {pendientes}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
