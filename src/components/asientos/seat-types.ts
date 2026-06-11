// Types for the seat map feature

export type SeatClass = "economica" | "ejecutiva"
export type SeatStatus = "libre" | "ocupado" | "seleccionado"

export interface Seat {
  id: string         // e.g. "3A"
  dbId: number       // DB primary key — needed for reservations (asiento_id)
  row: number        // 1–N
  col: string        // A–F
  clase: SeatClass
  status: SeatStatus
}

export const COLUMNS = ["A", "B", "C", "D", "E", "F"] as const
export type Column = (typeof COLUMNS)[number]

export interface SeatStats {
  total: number
  ocupados: number
  libres: number
  pct: number
}

// ---------------------------------------------------------------------------
// Runtime data — replaces the old MOCK constants
// ---------------------------------------------------------------------------

/**
 * Shape of a seat row as returned from `listarAsientosDeVuelo`.
 * We accept the DB fields directly so the page doesn't need to re-map them.
 */
export interface SeatInput {
  /** DB primary key — not used for display but convenient for React keys */
  id: number
  numero: string  // e.g. "3A" — seat identifier displayed on the button
  clase: string   // "economica" | "ejecutiva"
  estado: string  // "libre" | "ocupado" | "reservado"
}

/**
 * Parse a seat number like "3A" into { row: 3, col: "A" }.
 * Falls back to row=0, col="" for malformed numbers so we never throw.
 */
function parseSeatNumber(numero: string): { row: number; col: string } {
  const match = /^(\d+)([A-Fa-f])$/.exec(numero.trim())
  if (!match) return { row: 0, col: "" }
  return { row: parseInt(match[1]!, 10), col: match[2]!.toUpperCase() }
}

/**
 * Convert DB seat rows into the `Seat[]` format consumed by the map.
 *
 * - `estado = 'libre'` → status "libre"
 * - anything else (occupied, reserved, …) → status "ocupado"
 * - `clase` is cast to SeatClass; unknown values default to "economica"
 */
export function buildSeatsFromData(inputs: SeatInput[]): Seat[] {
  const seats: Seat[] = []
  for (const input of inputs) {
    const { row, col } = parseSeatNumber(input.numero)
    if (row === 0) continue // skip malformed numbers

    const clase: SeatClass =
      input.clase === "ejecutiva" ? "ejecutiva" : "economica"
    const status: SeatStatus =
      input.estado === "libre" ? "libre" : "ocupado"

    seats.push({ id: input.numero, dbId: input.id, row, col, clase, status })
  }
  return seats
}
