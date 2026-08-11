import { SidebarAdmin } from "@/features/admin/sidebar"
import { ExigirSesion } from "@/shared/ui/exigir-sesion"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ExigirSesion>
      <div className="flex min-h-screen bg-surface-app">
        <SidebarAdmin />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </ExigirSesion>
  )
}
