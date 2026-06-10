import type { Metadata } from "next"
import { ReservasTable } from "@/components/reservas/reservas-table"

export const metadata: Metadata = {
  title: "Reservas",
  description: "Gestión de reservas de pasajeros.",
}
import { NuevaReservaDialog } from "@/components/reservas/nueva-reserva-dialog"

export default function ReservasPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Reservas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestioná las reservas de los pasajeros
          </p>
        </div>
        <NuevaReservaDialog />
      </header>

      {/* ── Table ───────────────────────────────────────────────── */}
      <section aria-label="Listado de reservas">
        <ReservasTable />
      </section>
    </div>
  )
}
