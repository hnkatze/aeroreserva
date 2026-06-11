import { DatabaseIcon, KeyRoundIcon } from "lucide-react"
import type { IndiceTabla } from "@/lib/dba"

interface IndicesListProps {
  indices: readonly IndiceTabla[]
}

/** Group flat index rows by table name */
function agruparPorTabla(
  indices: readonly IndiceTabla[],
): Map<string, IndiceTabla[]> {
  const map = new Map<string, IndiceTabla[]>()
  for (const idx of indices) {
    const existing = map.get(idx.tabla)
    if (existing) {
      existing.push(idx)
    } else {
      map.set(idx.tabla, [idx])
    }
  }
  return map
}

/** Truncate long index definitions for display */
function truncar(def: string, max = 80): string {
  return def.length > max ? `${def.slice(0, max)}…` : def
}

export function IndicesList({ indices }: IndicesListProps) {
  const agrupados = agruparPorTabla(indices)

  return (
    <section aria-labelledby="indices-heading">
      <div className="mb-3">
        <h2
          id="indices-heading"
          className="font-heading text-base font-semibold text-foreground"
        >
          Índices
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Índices definidos en el esquema público, agrupados por tabla. Los índices
          aceleran las búsquedas pero consumen espacio y ralentizan las escrituras;
          un índice nunca usado es candidato a eliminarse.
        </p>
      </div>

      {agrupados.size === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-card py-12 text-muted-foreground">
          <DatabaseIcon className="h-8 w-8 opacity-30" aria-hidden="true" />
          <p className="font-mono text-sm">Sin índices encontrados</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" role="list" aria-label="Índices agrupados por tabla">
          {Array.from(agrupados.entries()).map(([tabla, idxs]) => (
            <li key={tabla} className="rounded-xl border bg-card">
              {/* Table header */}
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <DatabaseIcon
                  className="h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <h3 className="font-mono text-sm font-semibold text-foreground">
                  {tabla}
                </h3>
                <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-medium text-primary">
                  {idxs.length} {idxs.length === 1 ? "índice" : "índices"}
                </span>
              </div>

              {/* Index rows */}
              <ul role="list" className="divide-y">
                {idxs.map((idx) => (
                  <li
                    key={idx.nombre_indice}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <KeyRoundIcon
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-medium text-foreground">
                        {idx.nombre_indice}
                      </p>
                      <p
                        className="mt-0.5 font-mono text-[11px] text-muted-foreground"
                        title={idx.definicion}
                      >
                        {truncar(idx.definicion)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
