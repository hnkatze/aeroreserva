import Link from "next/link"
import type { Metadata } from "next"
import { listarOperadores, contarOperadores } from "@/lib/operadores"
import { UsuariosTable } from "@/components/usuarios/usuarios-table"
import { OperadorFormDialog } from "@/components/usuarios/operador-form-dialog"

export const metadata: Metadata = {
  title: "Usuarios",
  description: "Administración de operadores del sistema.",
}

const PAGE_SIZE = 25

interface UsuariosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function UsuariosPage({ searchParams }: UsuariosPageProps) {
  const sp = await searchParams

  const rawPage = sp["page"]
  const page = Math.max(1, Number(Array.isArray(rawPage) ? rawPage[0] : (rawPage ?? "1")))
  const offset = (page - 1) * PAGE_SIZE

  const [operadores, total] = await Promise.all([
    listarOperadores({ limit: PAGE_SIZE, offset }),
    contarOperadores(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  function pageHref(p: number): string {
    return `?page=${p}`
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">
            Usuarios
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestioná los operadores del sistema
          </p>
        </div>
        <OperadorFormDialog />
      </div>

      <UsuariosTable operadores={operadores} />

      {/* ── Paginación ─────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <nav
          aria-label="Navegación de páginas de usuarios"
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="text-muted-foreground">
            Página {page} de {totalPages}{" "}
            <span className="text-xs">({total} operadores en total)</span>
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
