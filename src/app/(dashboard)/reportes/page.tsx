// MOCK — todos los datos están hardcodeados; reemplazar con queries reales

import {
  TrendingUpIcon,
  PlaneIcon,
  UsersIcon,
  DollarSignIcon,
} from "lucide-react"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { OcupacionBarChart } from "@/components/reportes/ocupacion-bar-chart"
import { ResumenTable } from "@/components/reportes/resumen-table"

// MOCK — KPIs calculados a partir de los datos de ocupación
const KPI_DATA = [
  {
    label: "Ocupación promedio",
    value: "79%",
    icon: TrendingUpIcon,
    trend: "+4 pp vs. semana pasada",
    accent: true,
  },
  {
    label: "Vuelos llenos (≥90%)",
    value: "3",
    icon: PlaneIcon,
    trend: "AR 1401, AR 2210, AR 0915",
    accent: false,
  },
  {
    label: "Asientos vendidos",
    value: "1.089",
    icon: UsersIcon,
    trend: "de 1.360 disponibles",
    accent: false,
  },
  {
    label: "Ingresos estimados",
    value: "$218.400",
    icon: DollarSignIcon,
    trend: "+12% vs. período anterior",
    accent: false,
  },
] as const

export default function ReportesPage() {
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

      {/* ── Gráfico de barras ─────────────────────────────────────── */}
      <section aria-label="Gráfico de ocupación por vuelo">
        <OcupacionBarChart />
      </section>

      {/* ── Tabla resumen ─────────────────────────────────────────── */}
      <section aria-label="Tabla resumen de vuelos">
        <ResumenTable />
      </section>
    </div>
  )
}
