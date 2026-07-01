"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/shared/lib/utils"
import { FileText, Users, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react"

const nav = [
  { href: "/contratista", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contratista/trabajadores", label: "Trabajadores", icon: Users },
  { href: "/contratista/documentos", label: "Documentos", icon: FileText },
]

export function SidebarContratista() {
  const path = usePathname()

  return (
    <aside className="w-56 min-h-screen bg-[#0f172a] flex flex-col shrink-0">
      <div className="px-4 py-5 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
            <ShieldCheck size={14} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Acredita</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Portal Contratista</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/contratista" && path.startsWith(href))
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
  )
}
