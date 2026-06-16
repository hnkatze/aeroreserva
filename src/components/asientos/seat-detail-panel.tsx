"use client"

import { ArmchairIcon, CheckIcon, PlaneIcon, UserIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Seat, SeatStats } from "./seat-types"

interface SeatDetailPanelProps {
  seat: Seat | null
  stats: SeatStats
  flightLabel?: string
  onReservar: (seatId: string) => void
}

const CLASS_LABEL: Record<Seat["clase"], string> = {
  ejecutiva: "Ejecutiva",
  economica: "Económica",
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

function OccupancySummary({ stats }: { stats: SeatStats }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <span className="font-heading text-3xl font-bold text-foreground">
          {stats.pct}%
        </span>
        <span className="text-sm text-muted-foreground">ocupado</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <div
          className={cn(
            "h-full rounded-full",
            stats.pct >= 90 ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${stats.pct}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="font-heading text-lg font-bold text-foreground">
            {stats.libres}
          </p>
          <p className="text-xs text-muted-foreground">Libres</p>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="font-heading text-lg font-bold text-foreground">
            {stats.ocupados}
          </p>
          <p className="text-xs text-muted-foreground">Ocupados</p>
        </div>
      </div>
    </div>
  )
}

export function SeatDetailPanel({
  seat,
  stats,
  flightLabel,
  onReservar,
}: SeatDetailPanelProps) {
  if (!seat) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlaneIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            Resumen del vuelo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {flightLabel ? (
            <p className="font-mono text-sm text-muted-foreground">
              {flightLabel}
            </p>
          ) : null}
          <OccupancySummary stats={stats} />
          <p className="pt-1 text-xs text-muted-foreground">
            Seleccioná un asiento libre para ver su detalle y reservarlo.
          </p>
        </CardContent>
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

        {seat.status === "ocupado" && (
          <div
            className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-3"
            role="note"
            aria-label={
              seat.pasajeroNombre
                ? `Asiento reservado por ${seat.pasajeroNombre}`
                : "Asiento ocupado"
            }
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Reservado por
              </span>
            </div>
            {seat.pasajeroNombre ? (
              <>
                <p className="mt-1.5 text-sm font-semibold text-foreground">
                  {seat.pasajeroNombre}
                </p>
                {seat.pasajeroDocumento && (
                  <p className="font-mono text-xs text-muted-foreground">
                    Doc. {seat.pasajeroDocumento}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sin reserva confirmada asociada
              </p>
            )}
          </div>
        )}

        {seat.clase === "ejecutiva" && (
          <div
            className="mt-4 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 dark:border-indigo-500/50 dark:bg-indigo-950/40"
            role="note"
            aria-label="Este asiento pertenece a clase ejecutiva"
          >
            <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300">
              Clase ejecutiva — mayor espacio entre asientos
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <button
          type="button"
          onClick={() => onReservar(seat.id)}
          disabled={seat.status !== "libre"}
          aria-disabled={seat.status !== "libre"}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5",
            "bg-primary text-sm font-semibold text-primary-foreground",
            "transition-colors hover:bg-primary/90",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <CheckIcon className="h-4 w-4" aria-hidden="true" />
          {seat.status === "libre"
            ? `Reservar asiento ${seat.id}`
            : `Asiento ${seat.id} ocupado`}
        </button>
      </CardFooter>
    </Card>
  )
}
