import type { OcupacionRuta } from "@/lib/reportes"

interface TopRutasTableProps {
  rutas: OcupacionRuta[]
}

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
