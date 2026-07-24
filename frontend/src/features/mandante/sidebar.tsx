"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  ClipboardCheck,
  ClipboardList,
  Settings,
  LogOut,
  ShieldCheck,
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
  { href: "/mandante/requisitos", label: "Perfiles", icon: ClipboardList, corta: "Perfiles" },
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
      {/* Escritorio */}
      <aside className="hidden md:flex w-56 min-h-screen bg-[#0f172a] flex-col shrink-0">
        <div className="px-4 py-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
              <ShieldCheck size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Acredita</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Portal Mandante</p>
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
                    ? "bg-amber-500/15 text-amber-400 font-medium"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                {label}
                {href === "/mandante/revision" && porRevisar > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-semibold text-slate-900 flex items-center justify-center">
                    {porRevisar}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/8">
          <button
            onClick={() => { localStorage.clear(); window.location.href = "/login" }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-500 hover:text-slate-300 hover:bg-white/5 w-full transition-colors"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Teléfono: cabecera + barra inferior con las cuatro secciones de uso diario */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-[#0f172a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-amber-500 rounded-md flex items-center justify-center">
            <ShieldCheck size={12} className="text-white" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-semibold text-white">Acredita</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/mandante/requisitos" className="text-slate-400 p-1" aria-label="Perfiles">
            <ClipboardList size={16} />
          </Link>
          <Link href="/mandante/configuracion" className="text-slate-400 p-1" aria-label="Configuración">
            <Settings size={16} />
          </Link>
          <button
            onClick={() => { localStorage.clear(); window.location.href = "/login" }}
            className="text-slate-400 p-1"
            aria-label="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0f172a] border-t border-white/10 grid grid-cols-4">
        {nav.slice(0, 4).map(({ href, corta, icon: Icon }) => {
          const active = esActivo(path, href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors",
                active ? "text-amber-400 font-medium" : "text-slate-400"
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              {corta}
              {href === "/mandante/revision" && porRevisar > 0 && (
                <span className="absolute top-1.5 right-1/2 translate-x-4 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-[9px] font-semibold text-slate-900 flex items-center justify-center">
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
