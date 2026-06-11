import { DatabaseIcon } from "lucide-react"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TamanoTabla } from "@/lib/dba"

interface TamanosTableProps {
  filas: readonly TamanoTabla[]
}

export function TamanosTable({ filas }: TamanosTableProps) {
  const maxBytes = filas[0]?.bytes_total ?? 1

  return (
    <section aria-labelledby="tamanos-heading">
      <div className="mb-3">
        <h2
          id="tamanos-heading"
          className="font-heading text-base font-semibold text-foreground"
        >
          Tamaño por tabla
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cuánto espacio ocupa cada tabla en disco, separando datos e índices.
          Útil para planificar particionamiento o archivado de datos históricos.
        </p>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table aria-label="Tamaño por tabla">
          <TableCaption className="sr-only">
            Tamaño en disco de cada tabla pública, ordenadas de mayor a menor.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-4 w-[200px]">
                Tabla
              </TableHead>
              <TableHead scope="col" className="text-right">
                Filas (est.)
              </TableHead>
              <TableHead scope="col" className="text-right">
                Datos
              </TableHead>
              <TableHead scope="col" className="text-right">
                Índices
              </TableHead>
              <TableHead scope="col" className="pr-4 text-right">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <DatabaseIcon className="h-8 w-8 opacity-30" aria-hidden="true" />
                    <p className="font-mono text-sm">Sin datos disponibles</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filas.map((fila) => {
                const pct = maxBytes > 0 ? (fila.bytes_total / maxBytes) * 100 : 0
                const isTop = fila === filas[0]

                return (
                  <TableRow key={fila.tabla}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-xs font-medium text-foreground"
                        >
                          {fila.tabla}
                        </span>
                        {isTop && (
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            más grande
                          </span>
                        )}
                      </div>
                      {/* Mini progress bar */}
                      <div
                        className="mt-1.5 h-1 w-full max-w-[120px] rounded-full bg-muted"
                        aria-hidden="true"
                      >
                        <div
                          className={`h-full rounded-full transition-all motion-reduce:transition-none ${isTop ? "bg-amber-500" : "bg-primary/50"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fila.filas_estimadas.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fila.tamano_datos}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fila.tamano_indices}
                    </TableCell>
                    <TableCell className="pr-4 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                      {fila.tamano_total}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
