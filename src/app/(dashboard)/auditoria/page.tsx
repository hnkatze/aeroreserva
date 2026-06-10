import Link from "next/link"
import { ShieldCheckIcon } from "lucide-react"
import { AuditoriaTable } from "@/components/auditoria/auditoria-table"
import { listarBitacora, contarBitacora } from "@/lib/bitacora"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Auditoría",
  description: "Registro automático de cada cambio en la base de datos.",
}

const PAGE_SIZE = 25

interface AuditoriaPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AuditoriaPage({ searchParams }: AuditoriaPageProps) {
  const sp = await searchParams

  const rawPage = sp["page"]
  const page = Math.max(1, Number(Array.isArray(rawPage) ? rawPage[0] : (rawPage ?? "1")))
  const offset = (page - 1) * PAGE_SIZE

  const [registros, total] = await Promise.all([
    listarBitacora({ limit: PAGE_SIZE, offset }),
    contarBitacora(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  function pageHref(p: number): string {
    return `?page=${p}`
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Encabezado ───────────────────────────────────────────── */}
      <header className="flex items-start gap-3">
        <ShieldCheckIcon
          className="mt-1 h-7 w-7 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Auditoría
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro automático de cada cambio en la base de datos.
          </p>
        </div>
      </header>

      {/* ── Bitácora ─────────────────────────────────────────────── */}
      <section aria-label="Bitácora de auditoría">
        <AuditoriaTable registros={registros} />
      </section>

      {/* ── Paginación ─────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <nav
          aria-label="Navegación de páginas de auditoría"
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="text-muted-foreground">
            Página {page} de {totalPages}{" "}
            <span className="text-xs">({total} registros en total)</span>
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
