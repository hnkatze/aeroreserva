"use client"

import { useState, useMemo } from "react"
import { PlaneIcon } from "lucide-react"
import { SeatButton } from "./seat-button"
import { SeatLegend } from "./seat-legend"
import { SeatDetailPanel } from "./seat-detail-panel"
import {
  COLUMNS,
  EXECUTIVE_ROWS,
  OCCUPIED_SEATS,
  TOTAL_ROWS,
  type Seat,
  type SeatStats,
} from "./seat-types"

// Build the full seat grid from mock data
function buildSeats(): Seat[] {
  const seats: Seat[] = []
  for (let row = 1; row <= TOTAL_ROWS; row++) {
    for (const col of COLUMNS) {
      const id = `${row}${col}`
      seats.push({
        id,
        row,
        col,
        clase: EXECUTIVE_ROWS.has(row) ? "ejecutiva" : "economica",
        status: OCCUPIED_SEATS.has(id) ? "ocupado" : "libre",
      })
    }
  }
  return seats
}

// Left aisle cols A,B,C — right aisle cols D,E,F
const LEFT_COLS = ["A", "B", "C"] as const
const RIGHT_COLS = ["D", "E", "F"] as const

interface SeatMapProps {
  flightLabel?: string
}

export function SeatMap({ flightLabel }: SeatMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Seats are static (mock) — build once
  const seats = useMemo(() => buildSeats(), [])

  const seatById = useMemo(
    () => new Map(seats.map((s) => [s.id, s])),
    [seats]
  )

  const selectedSeat = selectedId ? seatById.get(selectedId) ?? null : null

  const stats: SeatStats = useMemo(() => {
    const total = seats.length
    const ocupados = seats.filter((s) => s.status === "ocupado").length
    const libres = total - ocupados
    return {
      total,
      ocupados,
      libres,
      pct: Math.round((ocupados / total) * 100),
    }
  }, [seats])

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  const rowMap = useMemo(() => {
    const map = new Map<number, Seat[]>()
    for (const seat of seats) {
      if (!map.has(seat.row)) map.set(seat.row, [])
      map.get(seat.row)!.push(seat)
    }
    return map
  }, [seats])

  return (
    <div className="flex flex-col gap-6">
      {/* Legend */}
      <SeatLegend />

      {/* Two-column layout: map + detail */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* ── Seat Map ───────────────────────────────────────────── */}
        <section
          aria-label="Mapa de asientos del avión"
          className="w-full overflow-x-auto lg:flex-1"
        >
          {/* Front-of-plane indicator */}
          <div
            className="mb-4 flex flex-col items-center gap-1"
            aria-hidden="true"
          >
            <div className="flex h-7 w-24 items-end justify-center rounded-t-[2.5rem] border border-b-0 border-border bg-muted/50">
              <PlaneIcon className="mb-1 h-4 w-4 text-muted-foreground" />
            </div>
            <span className="font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Frente
            </span>
          </div>

          {/* Column header */}
          <div
            className="mb-2 flex items-center justify-center"
            aria-hidden="true"
          >
            <div className="w-8 shrink-0" />
            <div className="flex gap-1">
              {LEFT_COLS.map((col) => (
                <div
                  key={col}
                  className="flex h-6 w-9 items-center justify-center font-mono text-xs font-semibold text-muted-foreground"
                >
                  {col}
                </div>
              ))}
            </div>
            <div className="mx-1 w-6" />
            <div className="flex gap-1">
              {RIGHT_COLS.map((col) => (
                <div
                  key={col}
                  className="flex h-6 w-9 items-center justify-center font-mono text-xs font-semibold text-muted-foreground"
                >
                  {col}
                </div>
              ))}
            </div>
            <div className="ml-3 w-9 shrink-0" />
          </div>

          {/* Rows */}
          <ol
            aria-label="Filas de asientos"
            className="flex flex-col items-center gap-1"
          >
            {Array.from({ length: TOTAL_ROWS }, (_, i) => i + 1).map((row) => {
              const rowSeats = rowMap.get(row) ?? []
              const leftSeats = rowSeats.filter((s) =>
                (LEFT_COLS as readonly string[]).includes(s.col)
              )
              const rightSeats = rowSeats.filter((s) =>
                (RIGHT_COLS as readonly string[]).includes(s.col)
              )
              const isExecutiveRow = EXECUTIVE_ROWS.has(row)

              return (
                <li key={row} className="flex items-center">
                  {/* Row number */}
                  <span
                    className="w-8 shrink-0 font-mono text-xs text-muted-foreground"
                    aria-label={`Fila ${row}`}
                  >
                    {row}
                  </span>

                  {/* Left block A B C */}
                  <div
                    className="flex gap-1"
                    role="group"
                    aria-label={`Fila ${row}, asientos A-C`}
                  >
                    {leftSeats.map((seat) => (
                      <SeatButton
                        key={seat.id}
                        seat={seat}
                        isSelected={selectedId === seat.id}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>

                  {/* Aisle — visible divider line */}
                  <div
                    className="mx-1 flex w-6 items-stretch justify-center"
                    aria-hidden="true"
                  >
                    <div className="w-px bg-border" />
                  </div>

                  {/* Right block D E F */}
                  <div
                    className="flex gap-1"
                    role="group"
                    aria-label={`Fila ${row}, asientos D-F`}
                  >
                    {rightSeats.map((seat) => (
                      <SeatButton
                        key={seat.id}
                        seat={seat}
                        isSelected={selectedId === seat.id}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>

                  {/* Executive badge — indigo, fixed-width slot to keep rows aligned */}
                  <span className="ml-3 flex w-9 shrink-0 justify-start">
                    {isExecutiveRow && (
                      <span
                        className="rounded-sm bg-indigo-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                        aria-label="Clase ejecutiva"
                      >
                        EJE
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>

        {/* ── Detail Panel (sticky) ───────────────────────────────── */}
        <aside
          aria-label="Detalle del asiento seleccionado"
          className="w-full lg:sticky lg:top-6 lg:w-72 lg:shrink-0"
        >
          <SeatDetailPanel
            seat={selectedSeat}
            stats={stats}
            flightLabel={flightLabel}
            onReservar={() => {}}
          />
        </aside>
      </div>
    </div>
  )
}
