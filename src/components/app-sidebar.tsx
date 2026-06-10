import Link from "next/link"
import { HomeIcon, UsersIcon, PlaneIcon } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { LogoutButton } from "@/components/logout-button"

interface Operator {
  id: number
  username: string
  role: "agente" | "admin" | "consulta"
}

interface AppSidebarProps {
  operator: Operator
}

const navItems = [
  {
    label: "Inicio",
    href: "/",
    icon: HomeIcon,
    disabled: false,
  },
  {
    label: "Usuarios",
    href: "/usuarios",
    icon: UsersIcon,
    disabled: false,
  },
  {
    label: "Vuelos",
    href: "/vuelos",
    icon: PlaneIcon,
    disabled: true,
    badge: "Próximamente",
  },
] as const

const ROLE_LABELS: Record<Operator["role"], string> = {
  agente: "Agente",
  admin: "Administrador",
  consulta: "Consulta",
}

export function AppSidebar({ operator }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <PlaneIcon className="h-5 w-5 shrink-0 text-sidebar-foreground" aria-hidden="true" />
          <span className="truncate font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            AeroReserva
          </span>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  {item.disabled ? (
                    <SidebarMenuButton
                      aria-disabled="true"
                      aria-label={`${item.label} — ${item.badge}`}
                      tooltip={item.label}
                      className="cursor-not-allowed"
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                        {item.badge}
                      </span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      tooltip={item.label}
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <div className="flex flex-col gap-2 p-1">
          <div className="flex flex-col gap-0.5 px-1 group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {operator.username}
            </span>
            <span className="text-xs text-muted-foreground">
              {ROLE_LABELS[operator.role]}
            </span>
          </div>
          <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
