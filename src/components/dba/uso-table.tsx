import { AlertTriangleIcon, DatabaseIcon } from "lucide-react"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EstadisticasUso } from "@/lib/dba"

interface UsoTableProps {
  filas: readonly EstadisticasUso[]
}

/** Threshold above which a table is flagged as a VACUUM candidate */
const DEAD_TUP_WARN = 100

/** Threshold for flagging high seq_scan with low idx_scan (possible missing index) */
const SEQ_SCAN_WARN = 50

export function UsoTable({ filas }: UsoTableProps) {
  return (
    <section aria-labelledby="uso-heading">
      <div className="mb-3">
        <h2
          id="uso-heading"
          className="font-heading text-base font-semibold text-foreground"
        >
          Estadísticas de uso
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Patrones de acceso y escritura por tabla. Muchas <strong>tuplas muertas</strong> indican
          que la tabla es candidata a <code className="font-mono">VACUUM</code>. Un{" "}
          <strong>seq_scan</strong> alto frente a un idx_scan bajo puede señalar un índice faltante.
        </p>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table aria-label="Estadísticas de uso por tabla">
          <TableCaption className="sr-only">
            Patrones de lectura y escritura de cada tabla en el esquema público.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-4 w-[160px]">
                Tabla
              </TableHead>
              <TableHead scope="col" className="text-right">
                Seq scans
              </TableHead>
              <TableHead scope="col" className="text-right">
                Index scans
              </TableHead>
              <TableHead scope="col" className="text-right">
                Inserts
              </TableHead>
              <TableHead scope="col" className="text-right">
                Updates
              </TableHead>
              <TableHead scope="col" className="text-right">
                Deletes
              </TableHead>
              <TableHead scope="col" className="text-right">
                Vivas
              </TableHead>
              <TableHead scope="col" className="pr-4 text-right">
                Muertas
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <DatabaseIcon className="h-8 w-8 opacity-30" aria-hidden="true" />
                    <p className="font-mono text-sm">Sin datos disponibles</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filas.map((fila) => {
                const needsVacuum = fila.tuplas_muertas >= DEAD_TUP_WARN
                const missingIndex =
                  fila.seq_scan >= SEQ_SCAN_WARN && fila.idx_scan < fila.seq_scan / 2

                return (
                  <TableRow key={fila.tabla}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {fila.tabla}
                        </span>
                        {(needsVacuum || missingIndex) && (
                          <AlertTriangleIcon
                            className="h-3.5 w-3.5 shrink-0 text-amber-500"
                            role="img"
                            aria-label={
                              needsVacuum
                                ? "Candidata a VACUUM"
                                : "Posible índice faltante"
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-xs tabular-nums ${
                        missingIndex
                          ? "font-semibold text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {fila.seq_scan.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fila.idx_scan.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fila.ins.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fila.upd.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fila.del.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fila.tuplas_vivas.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell
                      className={`pr-4 text-right font-mono text-xs tabular-nums ${
                        needsVacuum
                          ? "font-semibold text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {fila.tuplas_muertas.toLocaleString("es-AR")}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 border-t px-4 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            <span>Advertencia de rendimiento o mantenimiento</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/70" aria-hidden="true" />
            <span>
              Muertas ≥ {DEAD_TUP_WARN} → candidata a{" "}
              <code className="font-mono">VACUUM</code>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/70" aria-hidden="true" />
            <span>Seq scans altos → posible índice faltante</span>
          </div>
        </div>
      </div>
    </section>
  )
}
