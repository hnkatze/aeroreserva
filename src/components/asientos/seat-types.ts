// MOCK — types for the seat map feature

export type SeatClass = "economica" | "ejecutiva"
export type SeatStatus = "libre" | "ocupado" | "seleccionado"

export interface Seat {
  id: string         // e.g. "3A"
  row: number        // 1–20
  col: string        // A–F
  clase: SeatClass
  status: SeatStatus
}

// MOCK — hardcoded occupied seat IDs for visual demo
export const OCCUPIED_SEATS: ReadonlySet<string> = new Set([
  "1A", "1B",        // ejecutiva partial
  "2F",
  "3A", "3B", "3C",
  "5D", "5E",
  "7C", "7F",
  "9A", "9B",
  "11D", "11E", "11F",
  "12A", "12C", "12F",
  "14B", "14D",
  "15C", "15E",
  "17A", "17B", "17C",
  "18D", "18F",
  "20A", "20B", "20C", "20D", "20E", "20F",
])

// Rows 1–4 are executive class
export const EXECUTIVE_ROWS: ReadonlySet<number> = new Set([1, 2, 3, 4])

export const COLUMNS = ["A", "B", "C", "D", "E", "F"] as const
export type Column = (typeof COLUMNS)[number]

export const TOTAL_ROWS = 20

export interface SeatStats {
  total: number
  ocupados: number
  libres: number
  pct: number
}
