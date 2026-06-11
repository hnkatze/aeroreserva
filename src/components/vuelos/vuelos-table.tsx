"use client"

import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Vuelo } from "@/lib/vuelos"
import { EstadoVueloBadge } from "@/components/vuelos/estado-vuelo-badge"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHora(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function formatFecha(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// ---------------------------------------------------------------------------
// VuelosTable
// ---------------------------------------------------------------------------

/**
 * Columnas: Vuelo (código + fecha), Aerolínea, Ruta, Salida/Llegada,
 * Estado (badge de color + retraso en minutos si aplica), y acción "Ver asientos".
 * Ocupación se mantiene fuera de scope (requiere JOIN con asientos).
 */
interface VuelosTableProps {
  vuelos: readonly Vuelo[]
}

export function VuelosTable({ vuelos }: VuelosTableProps) {
  return (
    <Card>
      <CardContent className="px-0 pb-0">
        <Table aria-label="Listado de vuelos">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5 w-28">Vuelo</TableHead>
              <TableHead>Aerolínea</TableHead>
              <TableHead>Ruta</TableHead>
              <TableHead className="w-28">Salida</TableHead>
              <TableHead className="w-28">Llegada</TableHead>
              <TableHead className="w-36">Estado</TableHead>
              <TableHead className="pr-5 w-32 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {vuelos.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No se encontraron vuelos para los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              vuelos.map((vuelo) => (
                <TableRow key={vuelo.id}>
                  {/* Código + fecha */}
                  <TableCell className="pl-5">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {vuelo.codigo}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatFecha(vuelo.salida)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Aerolínea */}
                  <TableCell>
                    <span className="text-sm text-foreground">
                      {vuelo.aerolinea_nombre ?? vuelo.aerolinea_codigo ?? "—"}
                    </span>
                  </TableCell>

                  {/* Ruta — código IATA + ciudad; nombre del aeropuerto en el tooltip */}
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className="flex flex-col leading-tight"
                        title={vuelo.origen_nombre}
                      >
                        <span className="font-mono text-foreground">
                          {vuelo.origen}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {vuelo.origen_ciudad}
                        </span>
                      </span>
                      <span className="sr-only">a</span>
                      <ArrowRightIcon
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span
                        className="flex flex-col leading-tight"
                        title={vuelo.destino_nombre}
                      >
                        <span className="font-mono text-foreground">
                          {vuelo.destino}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {vuelo.destino_ciudad}
                        </span>
                      </span>
                    </div>
                  </TableCell>

                  {/* Salida */}
                  <TableCell>
                    <span className="font-mono text-sm text-foreground">
                      {formatHora(vuelo.salida)}
                    </span>
                  </TableCell>

                  {/* Llegada */}
                  <TableCell>
                    <span className="font-mono text-sm text-foreground">
                      {formatHora(vuelo.llegada)}
                    </span>
                  </TableCell>

                  {/* Estado */}
                  <TableCell>
                    <EstadoVueloBadge
                      estado={vuelo.estado}
                      retraso_min={vuelo.retraso_min}
                    />
                  </TableCell>

                  {/* Acción */}
                  <TableCell className="pr-5 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      nativeButton={false}
                      render={<Link href={`/asientos?vuelo=${vuelo.codigo}`} />}
                    >
                      Ver asientos
                    </Button>
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
