"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/shared/lib/utils"
import { LogoAcredita, MarcaAcredita } from "@/shared/ui/logo"
import {
  LayoutDashboard, Building2, BookOpen,
  Users, LogOut
} from "lucide-react"

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/mandantes", label: "Mandantes", icon: Building2 },
  { href: "/admin/catalogo", label: "Catálogo pilares", icon: BookOpen },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
]

export function SidebarAdmin() {
  const path = usePathname()

  // `sticky top-0 h-screen` y NO `min-h-screen`: con min-h este aside crecía al
  // alto de TODA la página y su pie quedaba anclado al final del documento, así
  // que había que scrollear hasta el fondo para verlo.
  return (
    <aside className="sticky top-0 h-screen w-56 bg-surface-inverse flex flex-col shrink-0">
      <div className="px-4 py-5 border-b border-line-inverse">
        <MarcaAcredita contexto="oscuro" subtitulo="Panel BERISA" />
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/admin" && path.startsWith(href))
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
  )
}
