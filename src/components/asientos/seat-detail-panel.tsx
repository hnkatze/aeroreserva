"use client"

import { ArmchairIcon, CheckIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Seat } from "./seat-types"

interface SeatDetailPanelProps {
  seat: Seat | null
  onReservar: (seatId: string) => void
}

const CLASS_LABEL: Record<Seat["clase"], string> = {
  ejecutiva: "Ejecutiva",
  economica: "Económica",
}

interface DetailRowProps {
  label: string
  value: string
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

export function SeatDetailPanel({ seat, onReservar }: SeatDetailPanelProps) {
  if (!seat) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <ArmchairIcon
          className="h-10 w-10 text-muted-foreground/40"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">
          Seleccioná un asiento para ver el detalle
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArmchairIcon className="h-4 w-4 text-primary" aria-hidden="true" />
          Asiento{" "}
          <span className="font-mono text-lg font-bold tracking-tight">
            {seat.id}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div
          className="divide-y divide-border"
          role="list"
          aria-label={`Detalle del asiento ${seat.id}`}
        >
          <div role="listitem">
            <DetailRow label="Número" value={seat.id} />
          </div>
          <div role="listitem">
            <DetailRow label="Fila" value={String(seat.row)} />
          </div>
          <div role="listitem">
            <DetailRow label="Columna" value={seat.col} />
          </div>
          <div role="listitem">
            <DetailRow label="Clase" value={CLASS_LABEL[seat.clase]} />
          </div>
          <div role="listitem">
            <DetailRow
              label="Estado"
              value={seat.status === "libre" ? "Disponible" : "Ocupado"}
            />
          </div>
        </div>

        {/* Clase indicator chip */}
        {seat.clase === "ejecutiva" && (
          <div
            className="mt-4 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 dark:bg-amber-950/30"
            role="note"
            aria-label="Este asiento pertenece a clase ejecutiva"
          >
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Clase ejecutiva — mayor espacio entre asientos
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <button
          type="button"
          onClick={() => onReservar(seat.id)}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5",
            "bg-primary text-primary-foreground text-sm font-semibold",
            "transition-colors hover:bg-primary/90",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
          )}
          aria-label={`Reservar asiento ${seat.id}`}
        >
          <CheckIcon className="h-4 w-4" aria-hidden="true" />
          Reservar asiento
        </button>
      </CardFooter>
    </Card>
  )
}
