import type { Metadata } from "next"
import Link from "next/link"
import { PlaneIcon } from "lucide-react"
import { SeatMap } from "@/components/asientos/seat-map"
import { buscarVueloPorCodigo } from "@/lib/vuelos"
import { listarAsientosDeVuelo } from "@/lib/asientos"

export const metadata: Metadata = {
  title: "Mapa de asientos",
  description: "Seleccioná asientos disponibles para una reserva.",
}

interface AsientosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function formatHora(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export default async function AsientosPage({ searchParams }: AsientosPageProps) {
  const sp = await searchParams
  const rawVuelo = sp["vuelo"]
  const codigoVuelo = (Array.isArray(rawVuelo) ? rawVuelo[0] : rawVuelo) ?? ""

  // No flight selected — show an instructional empty state
  if (!codigoVuelo) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Mapa de asientos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seleccioná un asiento para reservar
          </p>
        </header>

        <div
          className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-8 py-16 text-center"
          role="status"
          aria-label="No hay vuelo seleccionado"
        >
          <PlaneIcon className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            No hay ningún vuelo seleccionado
          </p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Buscá un vuelo en la lista y presioná{" "}
            <span className="font-semibold">Ver asientos</span> para abrir el mapa.
          </p>
          <Link
            href="/vuelos"
            className="mt-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ir a Vuelos
          </Link>
        </div>
      </div>
    )
  }

  // Resolve the flight and its seats in parallel
  const vuelo = await buscarVueloPorCodigo(codigoVuelo)

  // Flight not found
  if (!vuelo) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Mapa de asientos
          </h1>
        </header>

        <div
          className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-8 py-16 text-center"
          role="alert"
        >
          <PlaneIcon className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            Vuelo{" "}
            <span className="font-mono font-bold">{codigoVuelo}</span> no encontrado
          </p>
          <Link
            href="/vuelos"
            className="mt-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Volver a Vuelos
          </Link>
        </div>
      </div>
    )
  }

  // Fetch all seats (free + occupied) for this flight
  const asientos = await listarAsientosDeVuelo(vuelo.id)

  const flightLabel = [
    vuelo.codigo,
    `${vuelo.origen} → ${vuelo.destino}`,
    formatHora(vuelo.salida),
    vuelo.aerolinea_nombre ?? vuelo.aerolinea_codigo ?? "",
  ]
    .filter(Boolean)
    .join(" · ")

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

      {/* ── Flight info chip ─────────────────────────────────────── */}
      <section aria-label="Información del vuelo seleccionado">
        <div className="flex flex-wrap items-center gap-3">
          {/* Back link */}
          <Link
            href="/vuelos"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Volver al listado de vuelos"
          >
            ← Vuelos
          </Link>

          {/* Flight metadata chip */}
          <div
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
            aria-live="polite"
            aria-label="Información del vuelo"
          >
            <PlaneIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{flightLabel}</span>
            <span aria-label={`${asientos.length} asientos en total`}>
              · {asientos.length} asientos
            </span>
          </div>
        </div>
      </section>

      {/* ── Interactive seat map (client component) ──────────────── */}
      <section aria-label="Mapa de asientos interactivo">
        <SeatMap vueloId={vuelo.id} flightLabel={flightLabel} seats={asientos} />
      </section>
    </div>
  )
}
