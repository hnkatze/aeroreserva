import type { Metadata } from "next"
import { PlaneIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Mapa de asientos",
  description: "Seleccioná asientos disponibles para una reserva.",
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SeatMap } from "@/components/asientos/seat-map"

// MOCK — flight options; replace with real data when flight service is wired
const VUELOS_MOCK = [
  { id: "AR1304", label: "AR1304 · SCL → GRU", info: "09:45 · Boeing 737-800" },
  { id: "AR2201", label: "AR2201 · EZE → GRU", info: "13:20 · Airbus A320" },
  { id: "AR0552", label: "AR0552 · GRU → MVD", info: "16:55 · Boeing 737-800" },
] as const

export default function AsientosPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* ── Page header ──────────────────────────────────────────── */}
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Mapa de asientos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seleccioná un asiento para reservar
        </p>
      </header>

      {/* ── Flight selector ──────────────────────────────────────── */}
      <section aria-label="Selección de vuelo">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="vuelo-select-trigger"
              className="text-sm font-medium text-foreground"
            >
              Vuelo
            </label>
            {/*
              Base UI Select — the trigger gets id via data-slot;
              label association via htmlFor matches the trigger's rendered id.
            */}
            <Select defaultValue="AR1304">
              <SelectTrigger
                id="vuelo-select-trigger"
                size="default"
                className="w-72"
                aria-label="Seleccioná un vuelo"
              >
                <PlaneIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue placeholder="Elegí un vuelo" />
              </SelectTrigger>
              <SelectContent>
                {VUELOS_MOCK.map((vuelo) => (
                  <SelectItem key={vuelo.id} value={vuelo.id}>
                    <span className="font-mono font-semibold">{vuelo.id}</span>
                    &nbsp;·&nbsp;
                    <span className="text-muted-foreground">{vuelo.label.split("·")[1]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Flight metadata chip */}
          <div
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
            aria-live="polite"
            aria-label="Información del vuelo seleccionado"
          >
            <PlaneIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>AR1304 · SCL → GRU · 09:45 · Boeing 737-800 · 120 asientos</span>
          </div>
        </div>
      </section>

      {/* ── Interactive seat map (client component) ──────────────── */}
      <section aria-label="Mapa de asientos interactivo">
        <SeatMap flightLabel="AR1304 · SCL → GRU · 09:45 · Boeing 737-800" />
      </section>
    </div>
  )
}
