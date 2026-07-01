import { SidebarMandante } from "@/features/mandante/sidebar"

export default function MandanteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <SidebarMandante />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
