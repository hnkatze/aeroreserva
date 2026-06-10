import type { OcupacionVuelo } from "@/lib/reportes"

interface ResumenTableProps {
  vuelos: OcupacionVuelo[]
}

export function ResumenTable({ vuelos }: ResumenTableProps) {
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
              <th scope="col" className="px-5 py-3 font-medium text-muted-foreground">Vuelo</th>
              <th scope="col" className="px-5 py-3 font-medium text-muted-foreground">Ruta</th>
              <th scope="col" className="px-5 py-3 text-right font-medium text-muted-foreground">
                Capacidad
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium text-muted-foreground">
                Ocupados
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium text-muted-foreground">
                Ocupación
              </th>
            </tr>
          </thead>
          <tbody>
            {vuelos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-muted-foreground">
                  No hay datos de vuelos disponibles.
                </td>
              </tr>
            ) : (
              vuelos.map((vuelo, index) => {
                const pct = vuelo.pct_ocupacion
                const isFull = pct >= 90

                return (
                  <tr
                    key={vuelo.vuelo_id}
                    className={`border-b border-border last:border-0 ${
                      index % 2 === 0 ? "" : "bg-muted/30"
                    }`}
                  >
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-foreground">{vuelo.codigo}</span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {vuelo.origen} → {vuelo.destino}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">
                      {vuelo.total_asientos.toLocaleString("es-AR")}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">
                      {vuelo.ocupados.toLocaleString("es-AR")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                          isFull
                            ? "bg-amber-100 text-[#14275C] dark:bg-amber-500/20 dark:text-amber-400"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {pct}%{isFull && <span className="sr-only"> (lleno)</span>}
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
