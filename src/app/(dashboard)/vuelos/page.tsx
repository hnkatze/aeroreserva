import Link from "next/link"
import { VuelosFiltros } from "@/components/vuelos/vuelos-filtros"
import { VuelosTable } from "@/components/vuelos/vuelos-table"
import { listarVuelos, contarVuelos } from "@/lib/vuelos"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Vuelos",
  description: "Buscá y gestioná los vuelos programados.",
}

const PAGE_SIZE = 25

interface VuelosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function VuelosPage({ searchParams }: VuelosPageProps) {
  const sp = await searchParams
  const rawPage = sp["page"]
  const page = Math.max(1, Number(Array.isArray(rawPage) ? rawPage[0] : (rawPage ?? "1")))
  const offset = (page - 1) * PAGE_SIZE

  const [vuelos, total] = await Promise.all([
    listarVuelos({ limit: PAGE_SIZE, offset }),
    contarVuelos(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasPrev = page > 1
  const hasNext = page < totalPages

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
        <VuelosTable vuelos={vuelos} />
      </section>

      {/* ── Paginación ─────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <nav
          aria-label="Navegación de páginas de vuelos"
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="text-muted-foreground">
            Página {page} de {totalPages}{" "}
            <span className="text-xs">({total} vuelos en total)</span>
          </span>
          <div className="flex items-center gap-2">
            {hasPrev ? (
              <Link
                href={`?page=${page - 1}`}
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
                href={`?page=${page + 1}`}
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
