import { Sidebar } from "@/components/layout/sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-80 p-8">{children}</main>
    </div>
  )
}
