import { SidebarAdmin } from "@/features/admin/sidebar"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <SidebarAdmin />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
