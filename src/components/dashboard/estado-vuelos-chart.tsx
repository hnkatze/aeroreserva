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
import type { VuelosPorEstado } from "@/lib/reportes"
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface EstadoVuelosChartProps {
  estados: VuelosPorEstado[]
}

const ESTADO_LABEL: Record<string, string> = {
  programado: "Programado",
  abordando: "Abordando",
  despegado: "Despegado",
  aterrizado: "Aterrizado",
  retrasado: "Retrasado",
  cancelado: "Cancelado",
}

const ESTADO_COLOR: Record<string, string> = {
  programado: "var(--chart-1)",
  abordando: "var(--chart-2)",
  despegado: "var(--chart-3)",
  aterrizado: "oklch(0.64 0.16 160)",
  retrasado: "var(--chart-4)",
  cancelado: "var(--destructive)",
}

const chartConfig = {
  cantidad_vuelos: {
    label: "Vuelos",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function EstadoVuelosChart({ estados }: EstadoVuelosChartProps) {
  if (estados.length === 0) return null

  const chartData = estados.map((e) => ({
    ...e,
    label: ESTADO_LABEL[e.estado] ?? e.estado,
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Vuelos por estado
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Distribución operativa del catálogo completo
      </p>
      <figure aria-label="Gráfico de barras: vuelos por estado operativo (columnas verticales)">
        <figcaption className="sr-only">
          Columnas verticales con la cantidad de vuelos por estado: programado,
          abordando, despegado, aterrizado, retrasado y cancelado.
        </figcaption>
        <ChartContainer config={chartConfig} className="h-52 w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
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
                    const d = item.payload as VuelosPorEstado & {
                      label: string
                    }
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{d.label}</span>
                        <span>
                          {d.cantidad_vuelos.toLocaleString("es-AR")} vuelos
                        </span>
                        <span className="text-muted-foreground">
                          {d.pct_total}% del total
                        </span>
                      </div>
                    )
                  }}
                  hideLabel
                />
              }
            />
            <Bar dataKey="cantidad_vuelos" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {estados.map((e) => (
                <Cell
                  key={e.estado}
                  fill={ESTADO_COLOR[e.estado] ?? "var(--chart-1)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </figure>
    </div>
  )
}
