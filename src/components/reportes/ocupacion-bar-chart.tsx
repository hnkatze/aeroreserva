import type { OcupacionVuelo } from "@/lib/reportes"

interface OcupacionBarChartProps {
  vuelos: OcupacionVuelo[]
}

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
        <ul role="list" className="flex flex-col gap-3" aria-label="Gráfico de ocupación por vuelo">
          {vuelos.map((vuelo) => {
            const pct = vuelo.pct_ocupacion
            const isFull = pct >= 90
            const route = `${vuelo.origen} → ${vuelo.destino}`

            return (
              <li key={vuelo.vuelo_id}>
                {/* Row: label | bar | percentage */}
                <div className="flex items-center gap-3">
                  {/* Flight code label */}
                  <span
                    className="w-20 shrink-0 font-mono text-xs text-muted-foreground"
                    title={route}
                    aria-hidden="true"
                  >
                    {vuelo.codigo}
                  </span>

                  {/* Bar track */}
                  <div
                    className="relative h-5 flex-1 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Vuelo ${vuelo.codigo}, ruta ${route.replace("→", "a")}: ${pct}% de ocupación`}
                  >
                    {/* Bar fill — amber when ≥90%, primary otherwise */}
                    <div
                      className={`h-full rounded-full transition-all ${isFull ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Percentage label */}
                  <span
                    className={`w-10 shrink-0 text-right text-xs font-medium tabular-nums ${
                      isFull ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                    }`}
                    aria-hidden="true"
                  >
                    {pct}%
                  </span>
                </div>

                {/* Occupied / total sub-label */}
                <p className="mt-0.5 pl-[5.75rem] text-xs text-muted-foreground">
                  {vuelo.ocupados.toLocaleString("es-AR")} / {vuelo.total_asientos.toLocaleString("es-AR")} asientos
                </p>
              </li>
            )
          })}
        </ul>
      )}

      {/* Legend */}
      <div className="mt-5 flex items-center gap-5 border-t border-border pt-4">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-primary" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Normal (&lt;90%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-amber-500" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Lleno (≥90%)</span>
        </div>
      </div>
    </div>
  )
}
