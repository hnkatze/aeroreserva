import { DatabaseZapIcon } from "lucide-react"

import { SimulacionPanel } from "@/components/laboratorio/simulacion-panel"

export default function LaboratorioConcurrenciaPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header>
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"
            aria-hidden="true"
          >
            <DatabaseZapIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Laboratorio de concurrencia
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Demostrá cómo la base resuelve conflictos cuando dos operadores compiten por el mismo asiento.
            </p>
          </div>
        </div>
      </header>

      {/* ── Concept cards ────────────────────────────────────────── */}
      <section aria-label="Conceptos demostrados">
        <ul
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          role="list"
          aria-label="Conceptos de concurrencia en PostgreSQL"
        >
          {CONCEPTS.map((c) => (
            <li
              key={c.term}
              className="rounded-xl border border-border bg-card p-4"
            >
              <h2 className="font-heading text-sm font-semibold text-foreground">
                {c.term}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {c.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Simulation ───────────────────────────────────────────── */}
      <section aria-label="Simulación interactiva">
        <SimulacionPanel />
      </section>
    </div>
  )
}

// ── Static concept descriptions ───────────────────────────────────────────────

const CONCEPTS = [
  {
    term: "Niveles de aislamiento",
    description:
      "PostgreSQL ofrece READ COMMITTED, REPEATABLE READ y SERIALIZABLE. Cada nivel previene distintas anomalías a cambio de mayor overhead.",
  },
  {
    term: "Anomalías de lectura",
    description:
      "Lecturas no repetibles (el dato cambia entre dos SELECTs) y lecturas fantasma (aparecen filas nuevas) son las más comunes en sistemas de reservas.",
  },
  {
    term: "Deadlocks",
    description:
      "Ocurren cuando dos transacciones esperan mutuamente un lock que la otra tiene. PostgreSQL detecta el ciclo y aborta la víctima automáticamente.",
  },
] as const
