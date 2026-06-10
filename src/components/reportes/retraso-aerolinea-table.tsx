import type { RetrasoPorAerolinea } from "@/lib/reportes"

interface RetrasoAerolineaTableProps {
  aerolineas: RetrasoPorAerolinea[]
}

export function RetrasoAerolineaTable({
  aerolineas,
}: RetrasoAerolineaTableProps) {
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
