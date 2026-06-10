import { getCurrentOperator } from "@/lib/auth"
import {
  PlaneIcon,
  TicketIcon,
  TrendingUpIcon,
  HourglassIcon,
} from "lucide-react"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { ProximosVuelosTable } from "@/components/dashboard/proximos-vuelos-table"

// KPI data — MOCK: reemplazar cuando existan las queries reales sobre el catálogo de vuelos/reservas
const KPI_DATA = [
  {
    label: "Vuelos hoy",
    value: "48",
    icon: PlaneIcon,
    trend: "+12% vs ayer",
    accent: false,
  },
  {
    label: "Reservas activas",
    value: "1,247",
    icon: TicketIcon,
    trend: "+8% vs ayer",
    accent: false,
  },
  {
    label: "Ocupación promedio",
    value: "82%",
    icon: TrendingUpIcon,
    trend: "Promedio de la flota",
    accent: true, // renders with amber brand accent
  },
  {
    label: "En lista de espera",
    value: "23",
    icon: HourglassIcon,
    trend: "4 promovidos hoy",
    accent: false,
  },
] as const

export default async function DashboardHomePage() {
  // Layout already validates auth; this call is safe and returns the operator
  const operator = await getCurrentOperator()

  return (
    <div className="flex flex-col gap-8">
      {/* ── Greeting ──────────────────────────────────────────────── */}
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Hola, {operator?.username} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esto es lo que está pasando hoy
        </p>
      </header>

      {/* ── KPI row ───────────────────────────────────────────────── */}
      <section aria-label="Indicadores clave del día">
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          role="list"
        >
          {KPI_DATA.map((kpi) => (
            <li key={kpi.label}>
              <KpiCard
                label={kpi.label}
                value={kpi.value}
                icon={kpi.icon}
                trend={kpi.trend}
                accent={kpi.accent}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* ── Upcoming flights ──────────────────────────────────────── */}
      <section aria-label="Próximos vuelos">
        <ProximosVuelosTable />
      </section>
    </div>
  )
}
