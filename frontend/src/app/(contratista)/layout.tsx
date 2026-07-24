import { SidebarContratista } from "@/features/contratista/sidebar"

export default function ContratistaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarContratista />
      {/* En teléfono el contenido esquiva la cabecera y la barra inferior fijas.
          Cada página maneja su propio padding horizontal. */}
      <main className="flex-1 min-w-0 pt-14 pb-20 md:pt-0 md:pb-0">{children}</main>
    </div>
  )
}
