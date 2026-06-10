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
import { EstadoBreakdown } from "@/components/reportes/estado-breakdown"
import { TopRutasTable } from "@/components/reportes/top-rutas-table"
import { RetrasoAerolineaTable } from "@/components/reportes/retraso-aerolinea-table"
import { TopAeropuertosTable } from "@/components/reportes/top-aeropuertos-table"
import {
  ocupacionPorVuelo,
  resumenKpis,
  vuelosPorEstado,
  ocupacionPorRuta,
  retrasoPorAerolinea,
  topAeropuertos,
} from "@/lib/reportes"

export const metadata: Metadata = {
  title: "Reportes",
  description: "Indicadores de ocupación de la flota.",
}

/**
 * Página de reportes — Server Component asíncrono.
 *
 * Carga en paralelo todas las queries necesarias para las secciones:
 *   1. KPI cards              — resumenKpis()
 *   2. Gráfico de ocupación   — ocupacionPorVuelo()
 *   3. Tabla de vuelos        — (reutiliza vuelos del gráfico)
 *   4. Desglose por estado    — vuelosPorEstado()
 *   5. Top rutas              — ocupacionPorRuta()
 *   6. Puntualidad            — retrasoPorAerolinea()
 *   7. Top aeropuertos        — topAeropuertos()
 *
 * Si alguna query falla, Next.js propaga el error al error boundary más
 * cercano (error.tsx); no necesitamos try/catch aquí.
 */
export default async function ReportesPage() {
  // Parallel data fetching — todas las queries son independientes
  const [vuelos, kpis, estados, rutas, retrasos, aeropuertos] =
    await Promise.all([
      ocupacionPorVuelo({ limit: 20 }),
      resumenKpis(),
      vuelosPorEstado(),
      ocupacionPorRuta({ limit: 15 }),
      retrasoPorAerolinea(),
      topAeropuertos({ limit: 10 }),
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

      {/* ── Desglose por estado operativo ─────────────────────────── */}
      <section aria-label="Distribución de vuelos por estado operativo">
        <EstadoBreakdown estados={estados} />
      </section>

      {/* ── Top rutas por ocupación ───────────────────────────────── */}
      <section aria-label="Top rutas por porcentaje de ocupación">
        <TopRutasTable rutas={rutas} />
      </section>

      {/* ── Puntualidad por aerolínea ─────────────────────────────── */}
      <section aria-label="Puntualidad por aerolínea">
        <RetrasoAerolineaTable aerolineas={retrasos} />
      </section>

      {/* ── Top aeropuertos por tráfico ───────────────────────────── */}
      <section aria-label="Top aeropuertos por tráfico">
        <TopAeropuertosTable aeropuertos={aeropuertos} />
      </section>
    </div>
  )
}
