"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Plane,
  Armchair,
  Ticket,
  Hourglass,
  BarChart3,
  Users,
  Shield,
  GitBranch,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { label: "Inicio", href: "/", icon: LayoutDashboard },
  { label: "Vuelos", href: "/vuelos", icon: Plane },
  { label: "Asientos", href: "/asientos", icon: Armchair },
  { label: "Reservas", href: "/reservas", icon: Ticket },
  { label: "Lista de espera", href: "/lista-espera", icon: Hourglass },
  { label: "Reportes", href: "/reportes", icon: BarChart3 },
  { label: "Usuarios", href: "/usuarios", icon: Users },
  { label: "Auditoría", href: "/auditoria", icon: Shield },
  { label: "Lab. concurrencia", href: "/laboratorio", icon: GitBranch },
] as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="flex h-screen w-60 shrink-0 flex-col bg-primary"
      style={{ paddingBlock: "24px", paddingInline: "16px" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-1 pb-6">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent"
          aria-hidden="true"
        >
          <Plane className="h-5 w-5 text-primary" />
        </span>
        <span className="font-heading text-[17px] font-bold leading-tight text-primary-foreground">
          AeroReserva
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Navegación principal">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-white/10 font-semibold text-primary-foreground"
                  : "text-slate-300 hover:bg-white/5 hover:text-primary-foreground",
              )}
            >
              <Icon
                className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-brand-accent" : "text-slate-300")}
                aria-hidden="true"
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto flex items-center gap-2 px-1 pt-6">
        <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="font-mono text-[11px] text-slate-400">v2.4.1 · prod</span>
      </div>
    </aside>
  )
}
