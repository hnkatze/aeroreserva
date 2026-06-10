import type { Metadata } from "next"
import { InfoIcon } from "lucide-react"

import { ListaEsperaTable } from "@/components/lista-espera/lista-espera-table"
import { listarListaEspera } from "@/lib/lista-espera"

export const metadata: Metadata = {
  title: "Lista de espera",
  description: "Pasajeros en espera y promoción automática.",
}

export default async function ListaEsperaPage() {
  const entradas = await listarListaEspera()

  return (
    <div className="flex flex-col gap-8">
      {/* ── Encabezado ──────────────────────────────────────────────── */}
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Lista de espera
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pasajeros en espera de un asiento. La promoción es automática al
          liberarse uno.
        </p>
      </header>

      {/* ── Nota informativa ────────────────────────────────────────── */}
      <aside
        aria-label="Información sobre la promoción automática"
        className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30"
      >
        <InfoIcon
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Cuando se cancela una reserva confirmada, el trigger{" "}
          <strong className="font-semibold">trg_promover_espera</strong> promueve
          automáticamente al primer pasajero de la lista: crea una reserva
          confirmada, ocupa el asiento y marca la entrada como promovida.
          Todo dentro de una única transacción atómica.
        </p>
      </aside>

      {/* ── Tabla ───────────────────────────────────────────────────── */}
      <section aria-label="Lista de pasajeros en espera">
        <ListaEsperaTable entradas={entradas} />
      </section>
    </div>
  )
}
