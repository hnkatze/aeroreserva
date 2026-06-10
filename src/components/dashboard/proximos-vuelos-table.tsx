"use client"

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

// MOCK: reemplazar cuando exista el catálogo de vuelos en la DB
interface VueloRow {
  codigo: string
  origen: string
  destino: string
  salida: string
  estado: EstadoVuelo
  ocupacion: number
}

const VUELOS_MOCK: VueloRow[] = [
  { codigo: "AR1304", origen: "SCL", destino: "GRU", salida: "08:40", estado: "programado", ocupacion: 78 },
  { codigo: "AV8821", origen: "BOG", destino: "MDE", salida: "09:15", estado: "retrasado",  ocupacion: 92 },
  { codigo: "LA5502", origen: "EZE", destino: "LIM", salida: "10:00", estado: "programado", ocupacion: 65 },
  { codigo: "CM3317", origen: "PTY", destino: "GUA", salida: "11:30", estado: "cancelado",  ocupacion: 0  },
  { codigo: "AR0701", origen: "AEP", destino: "MVD", salida: "12:45", estado: "programado", ocupacion: 55 },
  { codigo: "LA9940", origen: "CCS", destino: "CUN", salida: "14:20", estado: "retrasado",  ocupacion: 88 },
]

function OcupacionBar({ pct }: { pct: number }) {
  const isHigh = pct >= 90

  return (
    <div className="flex items-center gap-2" aria-label={`Ocupación: ${pct}%`}>
      {/* Track */}
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isHigh ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs text-muted-foreground">
        {pct}%
      </span>
    </div>
  )
}

export function ProximosVuelosTable() {
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
            {VUELOS_MOCK.map((vuelo) => (
              <TableRow key={vuelo.codigo}>
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
                    {vuelo.salida}
                  </span>
                </TableCell>

                <TableCell>
                  <EstadoVueloBadge estado={vuelo.estado} />
                </TableCell>

                <TableCell className="pr-5">
                  <OcupacionBar pct={vuelo.ocupacion} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
