import { SidebarContratista } from "@/features/contratista/sidebar"

export default function ContratistaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarContratista />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
