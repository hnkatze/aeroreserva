import { FLIGHT_DATA } from "./ocupacion-bar-chart"

export function ResumenTable() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Resumen de vuelos
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Detalle de capacidad y ventas por vuelo
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Resumen de ocupación por vuelo">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 font-medium text-muted-foreground">Vuelo</th>
              <th className="px-5 py-3 font-medium text-muted-foreground">Ruta</th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">
                Capacidad
              </th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">
                Vendidos
              </th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">
                Ocupación
              </th>
            </tr>
          </thead>
          <tbody>
            {FLIGHT_DATA.map((flight, index) => {
              const pct = Math.round((flight.sold / flight.capacity) * 100)
              const isFull = pct >= 90

              return (
                <tr
                  key={flight.code}
                  className={`border-b border-border last:border-0 ${
                    index % 2 === 0 ? "" : "bg-muted/30"
                  }`}
                >
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs text-foreground">{flight.code}</span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{flight.route}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-foreground">
                    {flight.capacity.toLocaleString("es-AR")}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-foreground">
                    {flight.sold.toLocaleString("es-AR")}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                        isFull
                          ? "bg-amber-100 text-[#14275C] dark:bg-amber-500/20 dark:text-amber-400"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {pct}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
