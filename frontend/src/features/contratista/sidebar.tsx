"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/shared/lib/utils"
import { ModoFaena } from "@/shared/ui/modo-faena"
import { LogoAcredita, MarcaAcredita } from "@/shared/ui/logo"
import { api } from "@/shared/lib/api"
import { Briefcase, FileText, Users, LayoutDashboard, LogOut, UserCog } from "lucide-react"

const nav = [
  { href: "/contratista", label: "Inicio", icon: LayoutDashboard },
  { href: "/contratista/servicios", label: "Servicios", icon: Briefcase },
  { href: "/contratista/trabajadores", label: "Trabajadores", icon: Users },
  { href: "/contratista/documentos", label: "Documentos", icon: FileText },
  { href: "/contratista/equipo", label: "Equipo", icon: UserCog },
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
      {/* Escritorio.
          `sticky top-0 h-screen` y NO `min-h-screen`: como hijo de un flex
          estirado, con min-h el aside crecía al alto de TODA la página, así que
          "Cerrar sesión" quedaba anclado al final del documento —había que
          scrollear hasta el fondo para verlo— y en páginas largas la navegación
          entera se iba hacia arriba. Con h-screen mide una pantalla y sticky la
          mantiene en su lugar. */}
      <aside className="hidden md:flex sticky top-0 h-screen w-56 bg-surface-inverse flex-col shrink-0">
        <div className="px-4 py-5 border-b border-line-inverse">
          <MarcaAcredita contexto="oscuro" subtitulo="Portal Contratista" />
        </div>

        {/* overflow-y-auto: en pantallas bajas los ítems no caben en 100vh y sin
            esto el pie del sidebar quedaría recortado sin forma de llegar. */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5">
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
          <LogoAcredita size={20} className="text-brand-on-dark" />
          <p className="text-section text-ink-inverse">Acredita</p>
        </div>
        <div className="flex items-center gap-1">
          {/* A un toque y en la cabecera: quien lo necesita está afuera, con el
              teléfono en una mano, y no va a buscarlo en Configuración. */}
          <ModoFaena contexto="oscuro" />
          <button
            onClick={() => { localStorage.clear(); window.location.href = "/login" }}
            className="text-ink-inverse-muted p-1"
            aria-label="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Cinco destinos en cuatro columnas: "Equipo" caía solo a una segunda
          fila y la barra crecía al doble, tapando contenido. Se declara el
          número real. */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-inverse border-t border-white/10 grid grid-cols-5">
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
