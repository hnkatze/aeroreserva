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
import type { OcupacionRuta } from "@/lib/reportes"
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface TopRutasTableProps {
  rutas: OcupacionRuta[]
}

const chartConfig = {
  pct_ocupacion_prom: {
    label: "Ocupación %",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function TopRutasTable({ rutas }: TopRutasTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Top rutas por ocupación
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Rutas con mayor porcentaje de asientos vendidos
        </p>
      </div>

      {/* ── Bar chart: ocupación por ruta ──────────────────────────── */}
      {rutas.length > 0 && (
        <div className="border-b border-border px-5 pt-5 pb-2">
          <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Ocupación promedio por ruta (%)
          </p>
          <figure aria-label="Gráfico de barras: ocupación promedio por ruta (columnas verticales)">
            <figcaption className="sr-only">
              Columnas verticales con el porcentaje de ocupación promedio de
              cada ruta origen→destino. Las columnas en ámbar indican rutas con
              ≥90% de ocupación.
            </figcaption>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart
                accessibilityLayer
                data={rutas.map((r) => ({
                  ...r,
                  ruta: `${r.origen}→${r.destino}`,
                }))}
                margin={{ top: 8, right: 8, bottom: 52, left: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="ruta"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-55}
                  textAnchor="end"
                  height={64}
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
                        const d = item.payload as OcupacionRuta & {
                          ruta: string
                        }
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{d.ruta}</span>
                            <span className="font-semibold">
                              {value}% ocupación prom.
                            </span>
                            <span className="text-muted-foreground">
                              {d.asientos_ocupados.toLocaleString("es-AR")} /{" "}
                              {d.total_asientos.toLocaleString("es-AR")} asientos
                            </span>
                            <span className="text-muted-foreground">
                              {d.cantidad_vuelos.toLocaleString("es-AR")} vuelos
                            </span>
                          </div>
                        )
                      }}
                      hideLabel
                    />
                  }
                />
                <Bar
                  dataKey="pct_ocupacion_prom"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                >
                  {rutas.map((r) => (
                    <Cell
                      key={`${r.origen}-${r.destino}`}
                      fill={
                        r.pct_ocupacion_prom >= 90
                          ? "var(--chart-4)"
                          : "var(--chart-1)"
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
          aria-label="Top rutas por porcentaje de ocupación"
        >
          <thead>
            <tr className="border-b border-border text-left">
              <th
                scope="col"
                className="px-5 py-3 font-medium text-muted-foreground"
              >
                Ruta
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium text-muted-foreground"
              >
                Vuelos
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium text-muted-foreground"
              >
                Asientos
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium text-muted-foreground"
              >
                Ocupados
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium text-muted-foreground"
              >
                Ocupación
              </th>
            </tr>
          </thead>
          <tbody>
            {rutas.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-6 text-center text-sm text-muted-foreground"
                >
                  No hay datos de rutas disponibles.
                </td>
              </tr>
            ) : (
              rutas.map((ruta, index) => {
                const pct = ruta.pct_ocupacion_prom
                const isFull = pct >= 90

                return (
                  <tr
                    key={`${ruta.origen}-${ruta.destino}`}
                    className={`border-b border-border last:border-0 ${
                      index % 2 === 0 ? "" : "bg-muted/30"
                    }`}
                  >
                    <td className="px-5 py-3 font-medium text-foreground">
                      <span className="font-mono text-xs">
                        {ruta.origen}
                      </span>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <span className="font-mono text-xs">
                        {ruta.destino}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {ruta.cantidad_vuelos.toLocaleString("es-AR")}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">
                      {ruta.total_asientos.toLocaleString("es-AR")}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">
                      {ruta.asientos_ocupados.toLocaleString("es-AR")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                          isFull
                            ? "bg-amber-100 text-[#14275C] dark:bg-amber-500/20 dark:text-amber-400"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {pct}%{isFull && <span className="sr-only"> (llena)</span>}
                      </span>
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
