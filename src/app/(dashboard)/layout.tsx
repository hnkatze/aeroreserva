import { redirect } from "next/navigation"
import { getCurrentOperator } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Toaster } from "@/components/ui/sonner"
import { QueryLogDrawer } from "@/components/query-log/query-log-drawer"

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
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader operator={operator} />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-[1400px] px-6 py-8 lg:px-10">
            {children}
          </div>
        </main>
      </div>

      <Toaster />
      {process.env.NODE_ENV !== "production" && <QueryLogDrawer />}
    </div>
  )
}
