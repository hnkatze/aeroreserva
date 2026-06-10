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
import type { ReservaCompleta } from "@/lib/reservas"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KNOWN_ESTADOS: readonly EstadoReserva[] = [
  "confirmada",
  "en_espera",
  "cancelada",
]

function toEstadoBadge(estado: string): EstadoReserva {
  if ((KNOWN_ESTADOS as readonly string[]).includes(estado)) {
    return estado as EstadoReserva
  }
  return "confirmada"
}

function formatFecha(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Row actions menu
// ---------------------------------------------------------------------------

interface ReservaActionsMenuProps {
  reserva: ReservaCompleta
}

function ReservaActionsMenu({ reserva }: ReservaActionsMenuProps) {
  function handleVer() {
    toast.info(`Ver reserva #${reserva.id} — ${reserva.vuelo_codigo}`)
  }

  function handleCancelar() {
    toast.error(`Reserva #${reserva.id} cancelada (demo)`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Acciones para reserva #${reserva.id}`}
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

// ---------------------------------------------------------------------------
// ReservasTable
// ---------------------------------------------------------------------------

interface ReservasTableProps {
  reservas: ReservaCompleta[]
}

export function ReservasTable({ reservas }: ReservasTableProps) {
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
          {reservas.map((reserva) => (
            <TableRow key={reserva.id}>
              <TableCell className="pl-4">
                <span className="font-mono text-xs text-muted-foreground">
                  {`RSV-${String(reserva.id).padStart(5, "0")}`}
                </span>
              </TableCell>
              <TableCell className="font-medium">
                {reserva.pasajero_nombre}
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs">{reserva.vuelo_codigo}</span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs">
                  {reserva.asiento_numero}
                </span>
              </TableCell>
              <TableCell>
                <EstadoReservaBadge estado={toEstadoBadge(reserva.estado)} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatFecha(reserva.fecha)}
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
