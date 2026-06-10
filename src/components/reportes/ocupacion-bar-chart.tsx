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
import type { OcupacionVuelo } from "@/lib/reportes"
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface OcupacionBarChartProps {
  vuelos: OcupacionVuelo[]
}

const chartConfig = {
  pct_ocupacion: {
    label: "Ocupación",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function OcupacionBarChart({ vuelos }: OcupacionBarChartProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Ocupación por vuelo
      </h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Asientos ocupados vs. capacidad total — top {vuelos.length} vuelos
      </p>

      {vuelos.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          No hay datos de ocupación disponibles.
        </p>
      ) : (
        <figure aria-label="Gráfico de barras: ocupación por vuelo (columnas verticales)">
          <figcaption className="sr-only">
            Columnas verticales que muestran el porcentaje de ocupación de cada
            vuelo. Las columnas en ámbar indican vuelos con ≥90% de ocupación.
          </figcaption>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart
              accessibilityLayer
              data={vuelos}
              margin={{ top: 8, right: 8, bottom: 48, left: 8 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="codigo"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-55}
                textAnchor="end"
                height={60}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={38}
              />
              <Tooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => {
                      const d = item.payload as OcupacionVuelo
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">
                            {d.codigo} — {d.origen} → {d.destino}
                          </span>
                          <span>
                            {d.ocupados.toLocaleString("es-AR")} /{" "}
                            {d.total_asientos.toLocaleString("es-AR")} asientos
                          </span>
                          <span className="font-semibold">{value}% ocupación</span>
                        </div>
                      )
                    }}
                    hideLabel
                  />
                }
              />
              <Bar dataKey="pct_ocupacion" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {vuelos.map((v) => (
                  <Cell
                    key={v.vuelo_id}
                    fill={
                      v.pct_ocupacion >= 90
                        ? "var(--chart-4)"
                        : "var(--chart-1)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </figure>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-5 border-t border-border pt-4">
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ background: "var(--chart-1)" }}
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground">Normal (&lt;90%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ background: "var(--chart-4)" }}
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground">Lleno (≥90%)</span>
        </div>
      </div>
    </div>
  )
}
