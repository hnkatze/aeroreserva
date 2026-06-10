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
import type { TopAeropuerto } from "@/lib/reportes"
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface TopAeropuertosTableProps {
  aeropuertos: TopAeropuerto[]
}

const chartConfig = {
  trafico_total: {
    label: "Tráfico total",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function TopAeropuertosTable({
  aeropuertos,
}: TopAeropuertosTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Top aeropuertos por tráfico
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Movimientos totales (salidas + llegadas) por aeropuerto
        </p>
      </div>

      {/* ── Bar chart: tráfico por aeropuerto ─────────────────────── */}
      {aeropuertos.length > 0 && (
        <div className="border-b border-border px-5 pt-5 pb-2">
          <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Tráfico total (salidas + llegadas)
          </p>
          <figure aria-label="Gráfico de barras: tráfico por aeropuerto (columnas verticales)">
            <figcaption className="sr-only">
              Columnas verticales con el tráfico total de cada aeropuerto,
              medido como la suma de vuelos salientes y entrantes.
            </figcaption>
            <ChartContainer config={chartConfig} className="h-56 w-full">
              <BarChart
                accessibilityLayer
                data={aeropuertos}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="codigo"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => {
                        const d = item.payload as TopAeropuerto
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">
                              {d.nombre} ({d.codigo})
                            </span>
                            <span className="text-muted-foreground">
                              {d.ciudad}, {d.pais}
                            </span>
                            <span>
                              {d.trafico_total.toLocaleString("es-AR")} movimientos
                            </span>
                            <span className="text-muted-foreground text-xs">
                              ↑ {d.vuelos_salientes.toLocaleString("es-AR")} salidas
                              · ↓ {d.vuelos_entrantes.toLocaleString("es-AR")} llegadas
                            </span>
                          </div>
                        )
                      }}
                      hideLabel
                    />
                  }
                />
                <Bar dataKey="trafico_total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {aeropuertos.map((ap, i) => (
                    <Cell
                      key={ap.codigo}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
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
          aria-label="Top aeropuertos por tráfico total"
        >
          <thead>
            <tr className="border-b border-border text-left">
              <th
                scope="col"
                className="px-5 py-3 font-medium text-muted-foreground"
              >
                #
              </th>
              <th
                scope="col"
                className="px-5 py-3 font-medium text-muted-foreground"
              >
                Aeropuerto
              </th>
              <th
                scope="col"
                className="px-5 py-3 font-medium text-muted-foreground"
              >
                Ciudad
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium text-muted-foreground"
              >
                Salidas
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium text-muted-foreground"
              >
                Llegadas
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium text-muted-foreground"
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {aeropuertos.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-6 text-center text-sm text-muted-foreground"
                >
                  No hay datos de aeropuertos disponibles.
                </td>
              </tr>
            ) : (
              aeropuertos.map((ap, index) => (
                <tr
                  key={ap.codigo}
                  className={`border-b border-border last:border-0 ${
                    index % 2 === 0 ? "" : "bg-muted/30"
                  }`}
                >
                  <td className="px-5 py-3 tabular-nums text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-foreground">
                      {ap.nombre}
                    </span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {ap.codigo}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {ap.ciudad}
                    <span className="ml-1 text-xs text-muted-foreground/60">
                      {ap.pais}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-foreground">
                    {ap.vuelos_salientes.toLocaleString("es-AR")}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-foreground">
                    {ap.vuelos_entrantes.toLocaleString("es-AR")}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary">
                      {ap.trafico_total.toLocaleString("es-AR")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
