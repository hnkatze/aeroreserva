"use client"

import { ArrowUpCircleIcon } from "lucide-react"
import { toast } from "sonner"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// MOCK — pasajeros en lista de espera ordenados por posición
interface PasajeroEspera {
  posicion: number
  pasajero: string
  documento: string
  vuelo: string
  solicitado: string
}

const LISTA_ESPERA_MOCK: readonly PasajeroEspera[] = [
  {
    posicion: 1,
    pasajero: "Valentina Torres",
    documento: "DNI 32.847.190",
    vuelo: "AR1204",
    solicitado: "2025-07-18",
  },
  {
    posicion: 2,
    pasajero: "Marcos Delgado",
    documento: "DNI 28.114.572",
    vuelo: "AR1204",
    solicitado: "2025-07-18",
  },
  {
    posicion: 3,
    pasajero: "Lucía Fernández",
    documento: "DNI 40.223.881",
    vuelo: "LA5502",
    solicitado: "2025-07-19",
  },
  {
    posicion: 4,
    pasajero: "Rodrigo Paredes",
    documento: "PAS AR-1029847",
    vuelo: "AA7731",
    solicitado: "2025-07-20",
  },
  {
    posicion: 5,
    pasajero: "Camila Ríos",
    documento: "DNI 37.665.024",
    vuelo: "IB6612",
    solicitado: "2025-07-21",
  },
  {
    posicion: 6,
    pasajero: "Facundo Benítez",
    documento: "DNI 25.930.417",
    vuelo: "AR0850",
    solicitado: "2025-07-22",
  },
] as const

function PosicionBadge({ posicion }: { posicion: number }) {
  const esPrimero = posicion === 1

  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold leading-none",
        esPrimero
          ? "bg-amber-400 text-[#14275C]"
          : "bg-muted text-muted-foreground",
      )}
      aria-label={`Posición ${posicion} en la lista`}
    >
      {posicion}
    </span>
  )
}

function PromoverButton({
  pasajero,
  posicion,
}: {
  pasajero: PasajeroEspera
  posicion: number
}) {
  const esPrimero = posicion === 1

  function handlePromover() {
    toast.success(`${pasajero.pasajero} promovido/a al vuelo ${pasajero.vuelo} (demo)`)
  }

  return (
    <Button
      size={esPrimero ? "default" : "sm"}
      className={cn(
        esPrimero
          ? "bg-amber-400 text-[#14275C] hover:bg-amber-300 focus-visible:ring-amber-400/50"
          : "bg-muted text-foreground hover:bg-muted/70",
      )}
      onClick={handlePromover}
      aria-label={`Promover a ${pasajero.pasajero} en el vuelo ${pasajero.vuelo}`}
    >
      <ArrowUpCircleIcon className="h-4 w-4" aria-hidden="true" />
      Promover
    </Button>
  )
}

export function ListaEsperaTable() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <Table aria-label="Lista de espera">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4 w-24">Posición</TableHead>
            <TableHead>Pasajero</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Vuelo</TableHead>
            <TableHead>Solicitado</TableHead>
            <TableHead className="pr-4 text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {LISTA_ESPERA_MOCK.map((entrada) => (
            <TableRow
              key={`${entrada.documento}-${entrada.vuelo}`}
              className={cn(
                entrada.posicion === 1 &&
                  "bg-amber-50/60 dark:bg-amber-950/20",
              )}
            >
              <TableCell className="pl-4">
                <PosicionBadge posicion={entrada.posicion} />
              </TableCell>
              <TableCell className="font-medium text-foreground">
                {entrada.pasajero}
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs text-muted-foreground">
                  {entrada.documento}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs">{entrada.vuelo}</span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entrada.solicitado}
              </TableCell>
              <TableCell className="pr-4 text-right">
                <PromoverButton pasajero={entrada} posicion={entrada.posicion} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
