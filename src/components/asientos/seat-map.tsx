"use client"

import { useState, useMemo } from "react"
import { PlaneIcon } from "lucide-react"
import { SeatButton } from "./seat-button"
import { SeatLegend } from "./seat-legend"
import { SeatDetailPanel } from "./seat-detail-panel"
import { ReservarAsientoDialog } from "./reservar-asiento-dialog"
import {
  COLUMNS,
  type Seat,
  type SeatStats,
  type SeatInput,
  buildSeatsFromData,
} from "./seat-types"

// Left aisle cols A,B,C — right aisle cols D,E,F
const LEFT_COLS = ["A", "B", "C"] as const
const RIGHT_COLS = ["D", "E", "F"] as const

interface SeatMapProps {
  /** DB primary key of the flight — required to create a reservation */
  vueloId: number
  flightLabel?: string
  /**
   * Seat data from the database. When provided the map renders real occupancy
   * instead of the mock data.
   */
  seats?: SeatInput[]
}

export function SeatMap({ vueloId, flightLabel, seats: seatsProp }: SeatMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const seats = useMemo(() => buildSeatsFromData(seatsProp ?? []), [seatsProp])

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
      pct: total > 0 ? Math.round((ocupados / total) * 100) : 0,
    }
  }, [seats])

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  // Derive total rows from the data so the map adapts to any plane config
  const totalRows = useMemo(() => {
    if (seats.length === 0) return 0
    return Math.max(...seats.map((s) => s.row))
  }, [seats])

  const rowMap = useMemo(() => {
    const map = new Map<number, Seat[]>()
    for (const seat of seats) {
      if (!map.has(seat.row)) map.set(seat.row, [])
      map.get(seat.row)!.push(seat)
    }
    return map
  }, [seats])

  // Derive executive rows from the data (clase === "ejecutiva")
  const executiveRows = useMemo(() => {
    const rows = new Set<number>()
    for (const seat of seats) {
      if (seat.clase === "ejecutiva") rows.add(seat.row)
    }
    return rows
  }, [seats])

  if (seats.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-8 py-16 text-center text-sm text-muted-foreground">
        <PlaneIcon className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
        <p>No hay asientos cargados para este vuelo.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Legend */}
      <SeatLegend />

      {/* Map + detail — centered as a block so the cabin doesn't drift left */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
        {/* ── Seat Map ───────────────────────────────────────────── */}
        <section
          aria-label="Mapa de asientos del avión"
          className="w-full overflow-x-auto lg:w-auto"
        >
          <div className="mx-auto w-fit">
            {/* Front-of-plane indicator */}
            <div
              className="mb-4 flex flex-col items-center gap-1"
              aria-hidden="true"
            >
              <div className="flex h-8 w-28 items-end justify-center rounded-t-[2.5rem] border border-b-0 border-border bg-muted/50">
                <PlaneIcon className="mb-1.5 h-4 w-4 text-muted-foreground" />
              </div>
              <span className="font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Frente
              </span>
            </div>

            {/* Column header */}
            <div className="mb-2 flex items-center" aria-hidden="true">
              <div className="w-10 shrink-0" />
              <div className="flex gap-3">
                {LEFT_COLS.map((col) => (
                  <div
                    key={col}
                    className="flex h-6 w-11 items-center justify-center font-mono text-xs font-semibold text-muted-foreground"
                  >
                    {col}
                  </div>
                ))}
              </div>
              <div className="w-24" />
              <div className="flex gap-3">
                {RIGHT_COLS.map((col) => (
                  <div
                    key={col}
                    className="flex h-6 w-11 items-center justify-center font-mono text-xs font-semibold text-muted-foreground"
                  >
                    {col}
                  </div>
                ))}
              </div>
              <div className="ml-3 w-11 shrink-0" />
            </div>

            {/* Rows */}
            <ol aria-label="Filas de asientos" className="flex flex-col gap-2">
              {Array.from({ length: totalRows }, (_, i) => i + 1).map((row) => {
                const rowSeats = rowMap.get(row) ?? []
                const leftSeats = rowSeats.filter((s) =>
                  (LEFT_COLS as readonly string[]).includes(s.col)
                )
                const rightSeats = rowSeats.filter((s) =>
                  (RIGHT_COLS as readonly string[]).includes(s.col)
                )
                const isExecutiveRow = executiveRows.has(row)

                return (
                  <li key={row} className="flex items-center">
                    {/* Row number */}
                    <span
                      className="w-10 shrink-0 font-mono text-xs text-muted-foreground"
                      aria-hidden="true"
                    >
                      {row}
                    </span>

                    {/* Left block A B C */}
                    <div
                      className="flex gap-3"
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

                    {/* Aisle — wide gap with a centered divider line */}
                    <div
                      className="flex w-24 items-stretch justify-center"
                      aria-hidden="true"
                    >
                      <div className="w-px bg-border" />
                    </div>

                    {/* Right block D E F */}
                    <div
                      className="flex gap-3"
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

                    {/* Executive badge — fixed-width slot keeps rows aligned */}
                    <span className="ml-3 flex w-11 shrink-0 justify-start">
                      {isExecutiveRow && (
                        <span
                          className="rounded-sm bg-indigo-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                          aria-hidden="true"
                        >
                          EJE
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* ── Detail Panel (sticky) ───────────────────────────────── */}
        <aside
          aria-label="Detalle del asiento seleccionado"
          className="w-full lg:sticky lg:top-6 lg:w-80 lg:shrink-0"
        >
          <SeatDetailPanel
            seat={selectedSeat}
            stats={stats}
            flightLabel={flightLabel}
            onReservar={() => {
              if (selectedSeat?.status === "libre") setDialogOpen(true)
            }}
          />
        </aside>
      </div>

      {/* ── Reservation dialog ──────────────────────────────────────────────── */}
      <ReservarAsientoDialog
        vueloId={vueloId}
        asiento={
          selectedSeat
            ? {
                dbId: selectedSeat.dbId,
                numero: selectedSeat.id,
                clase: selectedSeat.clase,
              }
            : null
        }
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  )
}

export { COLUMNS }
