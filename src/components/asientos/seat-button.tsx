"use client"

import { cn } from "@/lib/utils"
import type { Seat } from "./seat-types"

interface SeatButtonProps {
  seat: Seat
  isSelected: boolean
  onSelect: (id: string) => void
}

export function SeatButton({ seat, isSelected, onSelect }: SeatButtonProps) {
  const isOccupied = seat.status === "ocupado"
  const isExecutive = seat.clase === "ejecutiva"

  // Occupied seats are still selectable (to inspect who reserved them) but not
  // reservable — the detail panel disables its "Reservar" action for them.
  const ariaLabel = isOccupied
    ? `Asiento ${seat.id}, ${seat.clase}, ocupado${isSelected ? ", seleccionado" : ""}`
    : `Asiento ${seat.id}, ${seat.clase}, ${isSelected ? "seleccionado" : seat.status}`

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      onClick={() => onSelect(seat.id)}
      className={cn(
        // Base shape — 44px square
        "flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border font-mono text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none",
        // Default: libre
        !isOccupied && !isSelected && !isExecutive &&
          "border-border bg-background text-foreground hover:bg-muted",
        // Libre ejecutiva — indigo accent (amber is reserved for "selected")
        !isOccupied && !isSelected && isExecutive &&
          "border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 dark:border-indigo-500/50 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/50",
        // Ocupado — stays blue even when selected; hover hints it's clickable
        isOccupied &&
          "border-transparent bg-primary text-primary-foreground opacity-80 hover:opacity-100",
        // Ocupado + seleccionado — amber ring marks selection without losing the blue fill
        isOccupied && isSelected &&
          "opacity-100 ring-2 ring-amber-400 ring-offset-1",
        // Libre seleccionado — amber bg, navy text always (guaranteed contrast)
        !isOccupied && isSelected &&
          "border-amber-400 bg-amber-500 text-[#14275C] shadow-sm ring-2 ring-amber-400/60",
      )}
    >
      {seat.id}
    </button>
  )
}
