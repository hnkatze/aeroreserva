import { Search, Bell, LogOut } from "lucide-react"
import { LogoutButton } from "@/components/logout-button"
import type { OperatorRole } from "@/lib/auth"

const ROLE_LABELS: Record<OperatorRole, string> = {
  agente: "Agente",
  admin: "Administrador",
  consulta: "Consulta",
}

interface Operator {
  username: string
  role: OperatorRole
}

interface DashboardHeaderProps {
  operator: Operator
  title?: string
  subtitle?: string
}

function getInitials(username: string): string {
  return username
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function DashboardHeader({
  operator,
  title = "Inicio",
  subtitle = "Resumen operativo del día",
}: DashboardHeaderProps) {
  const initials = getInitials(operator.username)

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border bg-background px-8">
      {/* Left: title block */}
      <div className="flex flex-col justify-center">
        <p className="font-heading text-xl font-semibold leading-tight text-foreground">
          {title}
        </p>
        <p className="text-[13px] leading-tight text-muted-foreground">{subtitle}</p>
      </div>

      {/* Right: search + actions */}
      <div className="flex items-center gap-4">
        {/* Search box */}
        <label className="sr-only" htmlFor="header-search">
          Buscar
        </label>
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="header-search"
            type="search"
            placeholder="Buscar vuelo, reserva, pasajero…"
            className="h-9 w-64 rounded-lg border border-border bg-muted pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Bell */}
        <button
          type="button"
          aria-label="Notificaciones"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-border" role="separator" aria-hidden="true" />

        {/* Operator */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground"
          >
            {initials}
          </span>

          {/* Name + role */}
          <div className="flex flex-col justify-center leading-tight">
            <span className="text-sm font-medium text-foreground">{operator.username}</span>
            <span className="text-[12px] text-muted-foreground">{ROLE_LABELS[operator.role]}</span>
          </div>
        </div>

        {/* Logout */}
        <LogoutButton />
      </div>
    </header>
  )
}
