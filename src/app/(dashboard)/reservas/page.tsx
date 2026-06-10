import Link from "next/link"
import type { Metadata } from "next"
import { ReservasTable } from "@/components/reservas/reservas-table"
import { NuevaReservaDialog } from "@/components/reservas/nueva-reserva-dialog"
import { listarReservas, contarReservas } from "@/lib/reservas"

export const metadata: Metadata = {
  title: "Reservas",
  description: "Gestión de reservas de pasajeros.",
}

const PAGE_SIZE = 25

interface ReservasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ReservasPage({ searchParams }: ReservasPageProps) {
  const sp = await searchParams

  const rawPage = sp["page"]
  const page = Math.max(1, Number(Array.isArray(rawPage) ? rawPage[0] : (rawPage ?? "1")))
  const offset = (page - 1) * PAGE_SIZE

  const [reservas, total] = await Promise.all([
    listarReservas({ limit: PAGE_SIZE, offset }),
    contarReservas(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  function pageHref(p: number): string {
    return `?page=${p}`
  }

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
        <ReservasTable reservas={reservas} />
      </section>

      {/* ── Paginación ─────────────────────────────────────────── */}
      {totalPages > 1 && (
        <nav
          aria-label="Navegación de páginas de reservas"
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="text-muted-foreground">
            Página {page} de {totalPages}{" "}
            <span className="text-xs">({total} reservas en total)</span>
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
