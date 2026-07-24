"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { Briefcase, FileText, Users, LayoutDashboard, LogOut, ShieldCheck, ShieldQuestion } from "lucide-react"

const nav = [
  { href: "/contratista", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contratista/servicios", label: "Servicios", icon: Briefcase },
  { href: "/contratista/trabajadores", label: "Trabajadores", icon: Users },
  { href: "/contratista/documentos", label: "Documentos", icon: FileText },
  { href: "/contratista/solicitudes", label: "Solicitudes", icon: ShieldQuestion },
]

export function SidebarContratista() {
  const path = usePathname()
  // Contador de solicitudes de acceso pendientes; se refresca al navegar
  // para que autorizar/rechazar lo baje sin recargar la página.
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => {
    api.get<unknown[]>("/api/v1/reutilizacion/solicitudes")
      .then(s => setPendientes(s.length))
      .catch(() => setPendientes(0))
  }, [path])

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
              {href === "/contratista/solicitudes" && pendientes > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-semibold text-slate-900 flex items-center justify-center">
                  {pendientes}
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
  )
}
