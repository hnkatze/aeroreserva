"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Tooltip,
} from "recharts"
import type { RetrasoPorAerolinea } from "@/lib/reportes"
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface RetrasoAerolineaTableProps {
  aerolineas: RetrasoPorAerolinea[]
}

const chartConfig = {
  retraso_min_prom_retrasados: {
    label: "Demora prom. (min)",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

export function RetrasoAerolineaTable({
  aerolineas,
}: RetrasoAerolineaTableProps) {
  // Only show airlines with actual delays in the chart
  const chartData = aerolineas.map((a) => ({
    ...a,
    nombre_corto: a.aerolinea_nombre ?? a.aerolinea_codigo,
    demora: a.retraso_min_prom_retrasados ?? 0,
  }))

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Puntualidad por aerolínea
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Vuelos retrasados y demora promedio por operador
        </p>
      </div>

      {/* ── Bar chart: demora promedio por aerolínea ───────────────── */}
      {aerolineas.length > 0 && (
        <div className="border-b border-border px-5 pt-5 pb-2">
          <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Demora promedio sobre vuelos retrasados (minutos)
          </p>
          <figure aria-label="Gráfico de barras: demora promedio por aerolínea (columnas verticales)">
            <figcaption className="sr-only">
              Columnas verticales con la demora promedio en minutos por cada
              aerolínea, calculada solo sobre los vuelos efectivamente
              retrasados.
            </figcaption>
            <ChartContainer config={chartConfig} className="h-52 w-full">
              <BarChart
                accessibilityLayer
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="nombre_corto"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tickFormatter={(v: number) => `${v}m`}
                />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => {
                        const d = item.payload as RetrasoPorAerolinea & {
                          nombre_corto: string
                          demora: number
                        }
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{d.nombre_corto}</span>
                            <span>
                              {d.demora > 0
                                ? `${d.demora} min de demora prom.`
                                : "Sin retrasos"}
                            </span>
                            <span className="text-muted-foreground">
                              {d.vuelos_retrasados.toLocaleString("es-AR")} vuelos
                              retrasados ({d.pct_retrasados}%)
                            </span>
                          </div>
                        )
                      }}
                      hideLabel
                    />
                  }
                />
                <Bar dataKey="demora" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {chartData.map((a) => (
                    <Cell
                      key={a.aerolinea_codigo}
                      fill={
                        a.pct_retrasados >= 5
                          ? "var(--destructive)"
                          : "var(--chart-4)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </figure>
        </div>
      )}

      {/* ── Tabla de detalle ───────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm"
          aria-label="Puntualidad por aerolínea"
        >
          <thead>
            <tr className="border-b border-border text-left">
              <th
                scope="col"
                className="px-5 py-3 font-medium text-muted-foreground"
              >
                Aerolínea
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium text-muted-foreground"
              >
                Total vuelos
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium text-muted-foreground"
              >
                Retrasados
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium text-muted-foreground"
              >
                % retraso
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium text-muted-foreground"
                title="Promedio de retraso en minutos, calculado solo sobre los vuelos efectivamente retrasados"
              >
                Demora prom.{" "}
                <abbr title="Solo vuelos retrasados" className="no-underline">
                  (ret.)
                </abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {aerolineas.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-6 text-center text-sm text-muted-foreground"
                >
                  No hay datos de puntualidad disponibles.
                </td>
              </tr>
            ) : (
              aerolineas.map((a, index) => {
                const hasDelays = a.vuelos_retrasados > 0
                const isHighDelay = a.pct_retrasados >= 5

                return (
                  <tr
                    key={a.aerolinea_codigo}
                    className={`border-b border-border last:border-0 ${
                      index % 2 === 0 ? "" : "bg-muted/30"
                    }`}
                  >
                    <td className="px-5 py-3">
                      <span className="font-medium text-foreground">
                        {a.aerolinea_nombre ?? a.aerolinea_codigo}
                      </span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {a.aerolinea_codigo}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">
                      {a.total_vuelos.toLocaleString("es-AR")}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">
                      {a.vuelos_retrasados.toLocaleString("es-AR")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {hasDelays ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                            isHighDelay
                              ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                          }`}
                        >
                          {a.pct_retrasados}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">
                      {a.retraso_min_prom_retrasados !== null ? (
                        <span>
                          {a.retraso_min_prom_retrasados.toLocaleString(
                            "es-AR",
                          )}{" "}
                          <span className="text-xs text-muted-foreground">
                            min
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
