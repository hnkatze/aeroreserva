import type { TopAeropuerto } from "@/lib/reportes"

interface TopAeropuertosTableProps {
  aeropuertos: TopAeropuerto[]
}

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
