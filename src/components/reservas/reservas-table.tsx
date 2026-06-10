"use client"

import { MoreHorizontalIcon, EyeIcon, XCircleIcon } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  EstadoReservaBadge,
  type EstadoReserva,
} from "@/components/reservas/estado-reserva-badge"

// MOCK — reservas hardcodeadas
interface Reserva {
  codigo: string
  pasajero: string
  vuelo: string
  asiento: string
  estado: EstadoReserva
  fecha: string
}

const RESERVAS_MOCK: readonly Reserva[] = [
  {
    codigo: "RSV-00128",
    pasajero: "María García",
    vuelo: "AR1204",
    asiento: "12A",
    estado: "confirmada",
    fecha: "2025-07-14",
  },
  {
    codigo: "RSV-00129",
    pasajero: "Carlos López",
    vuelo: "AR0850",
    asiento: "3C",
    estado: "en_espera",
    fecha: "2025-07-15",
  },
  {
    codigo: "RSV-00130",
    pasajero: "Sofía Martínez",
    vuelo: "LA5502",
    asiento: "7B",
    estado: "confirmada",
    fecha: "2025-07-15",
  },
  {
    codigo: "RSV-00131",
    pasajero: "Diego Rodríguez",
    vuelo: "AA7731",
    asiento: "22D",
    estado: "cancelada",
    fecha: "2025-07-16",
  },
  {
    codigo: "RSV-00132",
    pasajero: "Valentina Torres",
    vuelo: "IB6612",
    asiento: "1A",
    estado: "confirmada",
    fecha: "2025-07-18",
  },
  {
    codigo: "RSV-00133",
    pasajero: "Facundo Benítez",
    vuelo: "AR1204",
    asiento: "15F",
    estado: "en_espera",
    fecha: "2025-07-20",
  },
  {
    codigo: "RSV-00134",
    pasajero: "Lucía Fernández",
    vuelo: "AR0850",
    asiento: "4D",
    estado: "confirmada",
    fecha: "2025-07-22",
  },
] as const

function ReservaActionsMenu({ reserva }: { reserva: Reserva }) {
  function handleVer() {
    toast.info(`Ver reserva ${reserva.codigo} (demo)`)
  }

  function handleCancelar() {
    toast.error(`Reserva ${reserva.codigo} cancelada (demo)`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Acciones para reserva ${reserva.codigo}`}
          />
        }
      >
        <MoreHorizontalIcon className="h-4 w-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem onClick={handleVer}>
          <EyeIcon className="h-4 w-4" aria-hidden="true" />
          Ver detalle
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={handleCancelar}
          disabled={reserva.estado === "cancelada"}
        >
          <XCircleIcon className="h-4 w-4" aria-hidden="true" />
          Cancelar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ReservasTable() {
  return (
    <div className="rounded-xl border bg-card">
      <Table aria-label="Listado de reservas">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Código</TableHead>
            <TableHead>Pasajero</TableHead>
            <TableHead>Vuelo</TableHead>
            <TableHead>Asiento</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="pr-4 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {RESERVAS_MOCK.map((reserva) => (
            <TableRow key={reserva.codigo}>
              <TableCell className="pl-4">
                <span className="font-mono text-xs text-muted-foreground">
                  {reserva.codigo}
                </span>
              </TableCell>
              <TableCell className="font-medium">{reserva.pasajero}</TableCell>
              <TableCell>
                <span className="font-mono text-xs">{reserva.vuelo}</span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs">{reserva.asiento}</span>
              </TableCell>
              <TableCell>
                <EstadoReservaBadge estado={reserva.estado} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {reserva.fecha}
              </TableCell>
              <TableCell className="pr-4 text-right">
                <ReservaActionsMenu reserva={reserva} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
