import type { Metadata } from "next"
import {
  DatabaseIcon,
  HardDriveIcon,
  NetworkIcon,
  TableIcon,
} from "lucide-react"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { TamanosTable } from "@/components/dba/tamanos-table"
import { UsoTable } from "@/components/dba/uso-table"
import { IndicesList } from "@/components/dba/indices-list"
import {
  obtenerResumenBase,
  obtenerTamanosTablas,
  obtenerEstadisticasUso,
  obtenerIndices,
} from "@/lib/dba"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Administración de la base",
  description: "Métricas de salud y administración de la base de datos PostgreSQL.",
}

/**
 * DBA health panel — Server Component.
 *
 * Fetches all four catalog sections in parallel:
 *   1. Resumen         — obtenerResumenBase()
 *   2. Tamaños         — obtenerTamanosTablas()
 *   3. Estadísticas    — obtenerEstadisticasUso()
 *   4. Índices         — obtenerIndices()
 *
 * Data comes exclusively from PostgreSQL system catalogs (pg_catalog,
 * pg_stat_user_tables, pg_indexes) — all reads, no writes.
 */
export default async function DbaPage() {
  const [resumen, tamanos, estadisticas, indices] = await Promise.all([
    obtenerResumenBase(),
    obtenerTamanosTablas(),
    obtenerEstadisticasUso(),
    obtenerIndices(),
  ])

  const kpiItems = [
    {
      label: "Tamaño total de la BD",
      value: resumen.tamano_bd,
      icon: HardDriveIcon,
      trend: `Base de datos: ${resumen.nombre_bd}`,
      accent: true,
    },
    {
      label: "Versión de PostgreSQL",
      value: resumen.version_pg.replace("PostgreSQL ", ""),
      icon: DatabaseIcon,
      trend: "Motor de base de datos activo",
      accent: false,
    },
    {
      label: "Conexiones activas",
      value: resumen.conexiones_activas.toLocaleString("es-AR"),
      icon: NetworkIcon,
      trend: "En pg_stat_activity ahora mismo",
      accent: false,
    },
    {
      label: "Tablas públicas",
      value: resumen.total_tablas.toLocaleString("es-AR"),
      icon: TableIcon,
      trend: "Relaciones en el esquema public",
      accent: false,
    },
  ] as const

  return (
    <div className="flex flex-col gap-8">
      {/* ── Encabezado ───────────────────────────────────────────── */}
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Administración de la base
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Métricas en tiempo real desde los catálogos del sistema de PostgreSQL
        </p>
      </header>

      {/* ── Resumen — KPI cards ───────────────────────────────────── */}
      <section aria-labelledby="resumen-heading">
        <h2 id="resumen-heading" className="sr-only">
          Resumen de la base de datos
        </h2>
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          role="list"
          aria-label="Indicadores de la base de datos"
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

      {/* ── Tamaño por tabla ─────────────────────────────────────── */}
      <TamanosTable filas={tamanos} />

      {/* ── Estadísticas de uso ──────────────────────────────────── */}
      <UsoTable filas={estadisticas} />

      {/* ── Índices ──────────────────────────────────────────────── */}
      <IndicesList indices={indices} />
    </div>
  )
}
