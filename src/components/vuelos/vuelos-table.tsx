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
import { EstadoVueloBadge, type EstadoVuelo } from "@/components/dashboard/estado-vuelo-badge"
import { cn } from "@/lib/utils"

// MOCK: reemplazar cuando exista el catálogo de vuelos
export interface VueloCompleto {
  id: string
  codigo: string
  aerolinea: string
  origen: string
  destino: string
  salida: string        // "HH:MM"
  fecha: string         // "DD/MM/YYYY"
  estado: EstadoVuelo
  ocupacion: number     // 0-100
}

// MOCK: reemplazar cuando exista el catálogo de vuelos
const VUELOS_MOCK: VueloCompleto[] = [
  {
    id: "1",
    codigo: "LA4401",
    aerolinea: "LATAM",
    origen: "EZE",
    destino: "SCL",
    salida: "06:30",
    fecha: "09/06/2026",
    estado: "programado",
    ocupacion: 72,
  },
  {
    id: "2",
    codigo: "AR1304",
    aerolinea: "Aerolíneas Argentinas",
    origen: "AEP",
    destino: "GRU",
    salida: "08:40",
    fecha: "09/06/2026",
    estado: "programado",
    ocupacion: 78,
  },
  {
    id: "3",
    codigo: "AV8821",
    aerolinea: "Avianca",
    origen: "BOG",
    destino: "MDE",
    salida: "09:15",
    fecha: "09/06/2026",
    estado: "retrasado",
    ocupacion: 93,
  },
  {
    id: "4",
    codigo: "LA5502",
    aerolinea: "LATAM",
    origen: "EZE",
    destino: "LIM",
    salida: "10:00",
    fecha: "09/06/2026",
    estado: "programado",
    ocupacion: 65,
  },
  {
    id: "5",
    codigo: "CM3317",
    aerolinea: "Copa Airlines",
    origen: "PTY",
    destino: "GUA",
    salida: "11:30",
    fecha: "09/06/2026",
    estado: "cancelado",
    ocupacion: 0,
  },
  {
    id: "6",
    codigo: "AR0701",
    aerolinea: "Aerolíneas Argentinas",
    origen: "AEP",
    destino: "MVD",
    salida: "12:45",
    fecha: "09/06/2026",
    estado: "programado",
    ocupacion: 55,
  },
  {
    id: "7",
    codigo: "LA9940",
    aerolinea: "LATAM",
    origen: "SCL",
    destino: "UIO",
    salida: "14:20",
    fecha: "09/06/2026",
    estado: "retrasado",
    ocupacion: 88,
  },
  {
    id: "8",
    codigo: "AV2206",
    aerolinea: "Avianca",
    origen: "BOG",
    destino: "PTY",
    salida: "16:05",
    fecha: "09/06/2026",
    estado: "programado",
    ocupacion: 41,
  },
]

function OcupacionBar({ pct }: { pct: number }) {
  const isHigh = pct >= 90

  return (
    <div className="flex items-center gap-2" aria-label={`Ocupación: ${pct}%`}>
      {/* Track */}
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isHigh ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          "w-9 text-right font-mono text-xs",
          isHigh ? "font-semibold text-[#14275C]" : "text-muted-foreground",
        )}
      >
        {pct}%
      </span>
    </div>
  )
}

interface VuelosTableProps {
  vuelos?: VueloCompleto[]
}

export function VuelosTable({ vuelos = VUELOS_MOCK }: VuelosTableProps) {
  return (
    <Card>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5 w-28">Vuelo</TableHead>
              <TableHead>Aerolínea</TableHead>
              <TableHead>Ruta</TableHead>
              <TableHead className="w-28">Salida</TableHead>
              <TableHead className="w-32">Estado</TableHead>
              <TableHead className="w-36">Ocupación</TableHead>
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
                  {/* Código */}
                  <TableCell className="pl-5">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {vuelo.codigo}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {vuelo.fecha}
                      </span>
                    </div>
                  </TableCell>

                  {/* Aerolínea */}
                  <TableCell>
                    <span className="text-sm text-foreground">{vuelo.aerolinea}</span>
                  </TableCell>

                  {/* Ruta */}
                  <TableCell>
                    <span className="inline-flex items-center gap-1 font-mono text-sm text-foreground">
                      <span>{vuelo.origen}</span>
                      <ArrowRightIcon
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>{vuelo.destino}</span>
                    </span>
                  </TableCell>

                  {/* Salida */}
                  <TableCell>
                    <span className="font-mono text-sm text-foreground">{vuelo.salida}</span>
                  </TableCell>

                  {/* Estado */}
                  <TableCell>
                    <EstadoVueloBadge estado={vuelo.estado} />
                  </TableCell>

                  {/* Ocupación */}
                  <TableCell>
                    <OcupacionBar pct={vuelo.ocupacion} />
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
