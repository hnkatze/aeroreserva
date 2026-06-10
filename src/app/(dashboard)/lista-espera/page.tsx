import Link from "next/link"
import type { Metadata } from "next"
import { InfoIcon } from "lucide-react"

import { ListaEsperaTable } from "@/components/lista-espera/lista-espera-table"
import { listarListaEspera, contarListaEspera } from "@/lib/lista-espera"

export const metadata: Metadata = {
  title: "Lista de espera",
  description: "Pasajeros en espera y promoción automática.",
}

const PAGE_SIZE = 25

interface ListaEsperaPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ListaEsperaPage({ searchParams }: ListaEsperaPageProps) {
  const sp = await searchParams

  const rawPage = sp["page"]
  const page = Math.max(1, Number(Array.isArray(rawPage) ? rawPage[0] : (rawPage ?? "1")))
  const offset = (page - 1) * PAGE_SIZE

  const [entradas, total] = await Promise.all([
    listarListaEspera({ limit: PAGE_SIZE, offset }),
    contarListaEspera(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  function pageHref(p: number): string {
    return `?page=${p}`
  }

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

      {/* ── Paginación ──────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <nav
          aria-label="Navegación de páginas de lista de espera"
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="text-muted-foreground">
            Página {page} de {totalPages}{" "}
            <span className="text-xs">({total} entradas en total)</span>
          </span>
          <div className="flex items-center gap-2">
            {hasPrev ? (
              <Link
                href={pageHref(page - 1)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Ir a la página anterior, página ${page - 1}`}
              >
                Anterior
              </Link>
            ) : (
              <span
                className="cursor-not-allowed rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground"
                aria-disabled="true"
              >
                Anterior
              </span>
            )}
            {hasNext ? (
              <Link
                href={pageHref(page + 1)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Ir a la página siguiente, página ${page + 1}`}
              >
                Siguiente
              </Link>
            ) : (
              <span
                className="cursor-not-allowed rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground"
                aria-disabled="true"
              >
                Siguiente
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
