import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { EstadoVueloBadge, type EstadoVuelo } from "./estado-vuelo-badge"
import { cn } from "@/lib/utils"
import type { VueloProximo } from "@/lib/dashboard"

function OcupacionBar({
  ocupados,
  total,
  pct,
}: {
  ocupados: number
  total: number
  pct: number | null
}) {
  const pctDisplay = pct ?? 0
  const isHigh = pctDisplay >= 90
  const label =
    total > 0 ? `${ocupados}/${total} (${pctDisplay}%)` : "Sin asientos"

  return (
    <div className="flex items-center gap-2" aria-label={`Ocupación: ${label}`}>
      {/* Track */}
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isHigh ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${pctDisplay}%` }}
        />
      </div>
      <span className="w-[4.5rem] text-right font-mono text-xs text-muted-foreground">
        {total > 0 ? `${ocupados}/${total}` : "—"}
      </span>
    </div>
  )
}

function formatSalida(salida: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(salida))
}

interface ProximosVuelosTableProps {
  vuelos: VueloProximo[]
}

export function ProximosVuelosTable({ vuelos }: ProximosVuelosTableProps) {
  return (
    <Card>
      {/* Custom header to keep the "Ver todos" link in the same row */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Próximos vuelos
        </h2>
        <Link
          href="/vuelos"
          className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver todos
        </Link>
      </div>

      <CardContent className="px-0 pb-0">
        <Table aria-label="Próximos vuelos">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Vuelo</TableHead>
              <TableHead>Ruta</TableHead>
              <TableHead>Salida</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="pr-5">Ocupación</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {vuelos.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="pl-5 py-8 text-center text-sm text-muted-foreground"
                >
                  No hay vuelos próximos
                </TableCell>
              </TableRow>
            ) : (
              vuelos.map((vuelo) => (
                <TableRow key={vuelo.id}>
                  <TableCell className="pl-5">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {vuelo.codigo}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="font-mono text-sm text-foreground">
                      {vuelo.origen}
                      <span className="sr-only"> a </span>
                      <span className="mx-1 text-muted-foreground" aria-hidden="true">→</span>
                      {vuelo.destino}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="font-mono text-sm text-foreground">
                      {formatSalida(vuelo.salida)}
                    </span>
                  </TableCell>

                  <TableCell>
                    <EstadoVueloBadge estado={vuelo.estado as EstadoVuelo} />
                  </TableCell>

                  <TableCell className="pr-5">
                    <OcupacionBar
                      ocupados={vuelo.asientos_ocupados}
                      total={vuelo.asientos_total}
                      pct={vuelo.pct_ocupacion}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
