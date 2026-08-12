"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/shared/lib/utils"
import { ModoFaena } from "@/shared/ui/modo-faena"
import { LogoAcredita, MarcaAcredita } from "@/shared/ui/logo"
import { api } from "@/shared/lib/api"
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  MapPin,
  ClipboardCheck,
  ClipboardList,
  Settings,
  Users,
  LogOut,
} from "lucide-react"

/**
 * Seis secciones. Se quitó "Reportes": su única acción propia —exportar a
 * PDF/Excel— estaba deshabilitada con un "próximamente", y sus gráficos
 * duplicaban el estado que ahora vive en Inicio. Ofrecer una pestaña que
 * promete algo que no funciona es peor que no ofrecerla.
 *
 * Las tres primeras son el trabajo diario; las últimas, configuración que se
 * toca al principio y casi nunca más.
 */
const nav = [
  { href: "/mandante", label: "Inicio", icon: LayoutDashboard, corta: "Inicio" },
  { href: "/mandante/revision", label: "Revisión", icon: ClipboardCheck, corta: "Revisar" },
  { href: "/mandante/contratistas", label: "Contratistas", icon: Building2, corta: "Empresas" },
  { href: "/mandante/servicios", label: "Servicios", icon: Briefcase, corta: "Servicios" },
  // Despues de Servicios a proposito: la barra del telefono muestra los cuatro
  // primeros, y Servicios es uso diario mientras que los centros se configuran
  // una vez. Ponerlo antes sacaba Servicios del movil.
  { href: "/mandante/centros", label: "Centros", icon: MapPin, corta: "Centros" },
  { href: "/mandante/requisitos", label: "Perfiles", icon: ClipboardList, corta: "Perfiles" },
  // Invitar gente y decidir quien aprueba que no es un "ajuste" que se toca una
  // vez: es gestion recurrente con consecuencias reales. Enterrado como
  // subseccion de Configuracion nadie lo encontraba.
  { href: "/mandante/equipo", label: "Equipo", icon: Users, corta: "Equipo" },
  { href: "/mandante/configuracion", label: "Configuración", icon: Settings, corta: "Ajustes" },
]

function esActivo(path: string, href: string) {
  return path === href || (href !== "/mandante" && path.startsWith(href))
}

export function SidebarMandante() {
  const path = usePathname()
  // Documentos esperando su revisión: es su trabajo diario, así que el número
  // va donde lo vea sin entrar.
  const [porRevisar, setPorRevisar] = useState(0)

  useEffect(() => {
    api.get<unknown[]>("/api/v1/documentos/pendientes-revision")
      .then(d => setPorRevisar(d.length))
      .catch(() => setPorRevisar(0))
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
          <MarcaAcredita contexto="oscuro" subtitulo="Portal Mandante" />
        </div>

        {/* overflow-y-auto: en pantallas bajas siete secciones no caben en 100vh
            y sin esto el pie del sidebar quedaría recortado sin forma de llegar. */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = esActivo(path, href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-body transition-colors",
                  active
                    ? "bg-white/[0.06] text-ink-inverse font-medium border-l-2 border-brand-on-dark pl-[10px]"
                    : "text-ink-inverse-muted hover:text-ink-inverse hover:bg-white/5"
                )}
              >
                <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                {label}
                {href === "/mandante/revision" && porRevisar > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-accion-line text-accion-ink text-[10px] font-semibold flex items-center justify-center">
                    {porRevisar}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-line-inverse">
          <button
            onClick={() => { localStorage.clear(); window.location.href = "/login" }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-body text-ink-inverse-muted hover:text-ink-inverse hover:bg-white/5 w-full transition-colors"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Teléfono: cabecera + barra inferior con las cuatro secciones de uso diario */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-surface-inverse px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoAcredita size={20} className="text-brand-on-dark" />
          <p className="text-section text-ink-inverse">Acredita</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/mandante/centros" className="text-ink-inverse-muted p-1" aria-label="Centros de trabajo">
            <MapPin size={16} />
          </Link>
          <Link href="/mandante/requisitos" className="text-ink-inverse-muted p-1" aria-label="Perfiles">
            <ClipboardList size={16} />
          </Link>
          <Link href="/mandante/equipo" className="text-ink-inverse-muted p-1" aria-label="Equipo">
            <Users size={16} />
          </Link>
          <Link href="/mandante/configuracion" className="text-ink-inverse-muted p-1" aria-label="Configuración">
            <Settings size={16} />
          </Link>
          {/* A un toque: el prevencionista que revisa desde la obra lo necesita
              donde está mirando, no en Configuración. */}
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

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-inverse border-t border-white/10 grid grid-cols-4">
        {nav.slice(0, 4).map(({ href, corta, icon: Icon }) => {
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
              {corta}
              {href === "/mandante/revision" && porRevisar > 0 && (
                <span className="absolute top-1.5 right-1/2 translate-x-4 min-w-[16px] h-[16px] px-1 rounded-full bg-accion-line text-accion-ink text-[9px] font-semibold flex items-center justify-center">
                  {porRevisar}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
