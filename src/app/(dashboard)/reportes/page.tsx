import type { Metadata } from "next"
import {
  TrendingUpIcon,
  PlaneIcon,
  UsersIcon,
  AirplayIcon,
} from "lucide-react"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { OcupacionBarChart } from "@/components/reportes/ocupacion-bar-chart"
import { ResumenTable } from "@/components/reportes/resumen-table"
import {
  ocupacionPorVuelo,
  resumenKpis,
} from "@/lib/reportes"

export const metadata: Metadata = {
  title: "Reportes",
  description: "Indicadores de ocupación de la flota.",
}

/**
 * Página de reportes — Server Component asíncrono.
 *
 * Carga en paralelo los top-20 vuelos por ocupación y los KPIs globales.
 * Si alguna query falla, Next.js propaga el error al error boundary más
 * cercano (error.tsx); no necesitamos try/catch aquí.
 *
 * Los datos se comparten entre OcupacionBarChart y ResumenTable para
 * evitar dos queries separadas a la misma vista.
 */
export default async function ReportesPage() {
  // Parallel data fetching — ambas queries son independientes
  const [vuelos, kpis] = await Promise.all([
    ocupacionPorVuelo({ limit: 20 }),
    resumenKpis(),
  ])

  // Construir los KPI cards a partir de datos reales
  const kpiItems = [
    {
      label: "Ocupación global",
      value: `${kpis.pct_ocupacion_global}%`,
      icon: TrendingUpIcon,
      trend: `${kpis.asientos_ocupados.toLocaleString("es-AR")} asientos ocupados`,
      accent: true,
    },
    {
      label: "Vuelos llenos (≥90%)",
      value: kpis.vuelos_llenos.toLocaleString("es-AR"),
      icon: PlaneIcon,
      trend: `de ${kpis.total_vuelos.toLocaleString("es-AR")} vuelos en catálogo`,
      accent: false,
    },
    {
      label: "Reservas confirmadas",
      value: kpis.reservas_confirmadas.toLocaleString("es-AR"),
      icon: UsersIcon,
      trend: `${kpis.asientos_libres.toLocaleString("es-AR")} asientos libres`,
      accent: false,
    },
    {
      label: "Aerolíneas activas",
      value: kpis.aerolineas_activas.toLocaleString("es-AR"),
      icon: AirplayIcon,
      trend: `${kpis.total_asientos.toLocaleString("es-AR")} asientos en flota`,
      accent: false,
    },
  ] as const

  return (
    <div className="flex flex-col gap-8">
      {/* ── Encabezado ──────────────────────────────────────────────── */}
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Reportes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ocupación y métricas de la operación
        </p>
      </header>

      {/* ── KPI row ───────────────────────────────────────────────── */}
      <section aria-label="Indicadores de ocupación">
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          role="list"
        >
          {kpiItems.map((kpi) => (
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

      {/* ── Gráfico de barras ─────────────────────────────────────── */}
      <section aria-label="Gráfico de ocupación por vuelo">
        <OcupacionBarChart vuelos={vuelos} />
      </section>

      {/* ── Tabla resumen ─────────────────────────────────────────── */}
      <section aria-label="Tabla resumen de vuelos">
        <ResumenTable vuelos={vuelos} />
      </section>
    </div>
  )
}
