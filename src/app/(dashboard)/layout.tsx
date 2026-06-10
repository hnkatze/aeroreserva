import { redirect } from "next/navigation"
import { getCurrentOperator } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/sonner"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const operator = await getCurrentOperator()

  if (!operator) {
    redirect("/login")
  }

  return (
    <SidebarProvider>
      <AppSidebar operator={operator} />

      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger aria-label="Alternar sidebar" className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 h-4" />
          <span className="text-sm font-medium text-foreground">AeroReserva</span>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </div>
      </SidebarInset>

      <Toaster />
    </SidebarProvider>
  )
}
