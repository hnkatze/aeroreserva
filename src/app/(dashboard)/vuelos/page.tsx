import { VuelosFiltros } from "@/components/vuelos/vuelos-filtros"
import { VuelosTable } from "@/components/vuelos/vuelos-table"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Vuelos",
  description: "Buscá y gestioná los vuelos programados.",
}

export default function VuelosPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* ── Encabezado ────────────────────────────────────────────── */}
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Vuelos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buscá y gestioná los vuelos programados
        </p>
      </header>

      {/* ── Filtros ────────────────────────────────────────────────── */}
      <section aria-label="Filtros de búsqueda">
        <VuelosFiltros />
      </section>

      {/* ── Tabla de vuelos ────────────────────────────────────────── */}
      <section aria-label="Listado de vuelos">
        <VuelosTable />
      </section>
    </div>
  )
}
