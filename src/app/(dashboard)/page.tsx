import type { Metadata } from "next"
import { getCurrentOperator } from "@/lib/auth"
import {
  PlaneIcon,
  TicketIcon,
  TrendingUpIcon,
  HourglassIcon,
} from "lucide-react"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { ProximosVuelosTable } from "@/components/dashboard/proximos-vuelos-table"
import { EstadoVuelosChart } from "@/components/dashboard/estado-vuelos-chart"
import { kpisDashboard, proximosVuelos } from "@/lib/dashboard"
import { vuelosPorEstado } from "@/lib/reportes"

export const metadata: Metadata = {
  title: "Inicio",
  description: "Resumen operativo del día: vuelos, reservas y lista de espera.",
}

export default async function DashboardHomePage() {
  // Layout already validates auth; this call is safe and returns the operator
  const [operator, kpis, vuelos, estados] = await Promise.all([
    getCurrentOperator(),
    kpisDashboard(),
    proximosVuelos({ limit: 8 }),
    vuelosPorEstado(),
  ])

  const ocupacionLabel =
    kpis.ocupacionPromedio !== null
      ? `${kpis.ocupacionPromedio}%`
      : "—"

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
          <li>
            <KpiCard
              label="Reservas activas"
              value={kpis.reservasActivas.toLocaleString("es-AR")}
              icon={TicketIcon}
              trend="Estado: confirmada"
            />
          </li>
          <li>
            <KpiCard
              label="Ocupación promedio"
              value={ocupacionLabel}
              icon={TrendingUpIcon}
              trend="Vuelos con pasajeros"
              accent
            />
          </li>
          <li>
            <KpiCard
              label="Vuelos retrasados"
              value={kpis.vuelosRetrasados.toLocaleString("es-AR")}
              icon={PlaneIcon}
              trend="Estado: retrasado"
            />
          </li>
          <li>
            <KpiCard
              label="En lista de espera"
              value={kpis.enListaEspera.toLocaleString("es-AR")}
              icon={HourglassIcon}
              trend="Estado: esperando"
            />
          </li>
        </ul>
      </section>

      {/* ── Estado de vuelos chart ────────────────────────────────── */}
      <section aria-label="Distribución de vuelos por estado operativo">
        <EstadoVuelosChart estados={estados} />
      </section>

      {/* ── Upcoming flights ──────────────────────────────────────── */}
      <section aria-label="Próximos vuelos">
        <ProximosVuelosTable vuelos={vuelos} />
      </section>
    </div>
  )
}
