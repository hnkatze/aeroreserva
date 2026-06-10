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

  // Derived display status
  const displayStatus = isSelected ? "seleccionado" : seat.status

  const ariaLabel = `Asiento ${seat.id}, ${seat.clase}, ${displayStatus}`

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      disabled={isOccupied}
      onClick={() => !isOccupied && onSelect(seat.id)}
      className={cn(
        // Base shape — 36px square
        "flex h-9 w-9 items-center justify-center rounded-md border font-mono text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none",
        // Default: libre
        !isOccupied && !isSelected && !isExecutive &&
          "border-border bg-background text-foreground hover:bg-muted",
        // Libre ejecutiva — subtle amber tint
        !isOccupied && !isSelected && isExecutive &&
          "border-amber-300/60 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/40",
        // Ocupado
        isOccupied &&
          "cursor-not-allowed border-transparent bg-primary text-primary-foreground opacity-80",
        // Seleccionado — amber bg, navy text always (guaranteed contrast)
        isSelected &&
          "border-amber-400 bg-amber-500 text-[#14275C] shadow-sm ring-2 ring-amber-400/60",
      )}
    >
      {seat.id}
    </button>
  )
}
