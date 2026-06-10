// MOCK — reemplazar con queries reales cuando esté disponible el modelo de reservas

interface FlightOccupancy {
  code: string
  route: string
  capacity: number
  sold: number
}

const FLIGHT_DATA: FlightOccupancy[] = [
  { code: "AR 1401", route: "EZE → MIA", capacity: 180, sold: 174 },
  { code: "AR 1820", route: "EZE → MAD", capacity: 250, sold: 215 },
  { code: "AR 0730", route: "AEP → SCL", capacity: 120, sold: 108 },
  { code: "AR 1105", route: "EZE → GRU", capacity: 180, sold: 97 },
  { code: "AR 2210", route: "AEP → MVD", capacity: 80,  sold: 79 },
  { code: "AR 0540", route: "EZE → CDG", capacity: 250, sold: 161 },
  { code: "AR 3301", route: "COR → EZE", capacity: 100, sold: 63 },
  { code: "AR 0915", route: "EZE → JFK", capacity: 200, sold: 192 },
]

export { FLIGHT_DATA }
export type { FlightOccupancy }

export function OcupacionBarChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Ocupación por vuelo
      </h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Asientos vendidos vs. capacidad total
      </p>

      <ul role="list" className="flex flex-col gap-3" aria-label="Gráfico de ocupación por vuelo">
        {FLIGHT_DATA.map((flight) => {
          const pct = Math.round((flight.sold / flight.capacity) * 100)
          const isFull = pct >= 90

          return (
            <li key={flight.code}>
              {/* Row: label | bar | percentage */}
              <div className="flex items-center gap-3">
                {/* Flight code label */}
                <span
                  className="w-20 shrink-0 font-mono text-xs text-muted-foreground"
                  title={flight.route}
                  aria-hidden="true"
                >
                  {flight.code}
                </span>

                {/* Bar track */}
                <div
                  className="relative h-5 flex-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Vuelo ${flight.code}, ruta ${flight.route.replace("→", "a")}: ${pct}% de ocupación`}
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

              {/* Sold / capacity sub-label */}
              <p className="mt-0.5 pl-[5.75rem] text-xs text-muted-foreground">
                {flight.sold.toLocaleString("es-AR")} / {flight.capacity.toLocaleString("es-AR")} asientos
              </p>
            </li>
          )
        })}
      </ul>

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
