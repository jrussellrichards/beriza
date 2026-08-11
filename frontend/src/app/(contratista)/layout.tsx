import { SidebarContratista } from "@/features/contratista/sidebar"
import { ExigirSesion } from "@/shared/ui/exigir-sesion"

export default function ContratistaLayout({ children }: { children: React.ReactNode }) {
  return (
    <ExigirSesion>
      <div className="flex min-h-screen bg-surface-app">
        <SidebarContratista />
        {/* En teléfono el contenido esquiva la cabecera y la barra inferior fijas.
            Cada página maneja su propio padding horizontal. */}
        <main className="flex-1 min-w-0 pt-14 pb-20 md:pt-0 md:pb-0">{children}</main>
      </div>
    </ExigirSesion>
  )
}
