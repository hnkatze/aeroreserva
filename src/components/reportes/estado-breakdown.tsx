import type { VuelosPorEstado } from "@/lib/reportes"

interface EstadoBreakdownProps {
  estados: VuelosPorEstado[]
}

/** Map estado → label legible en español */
const ESTADO_LABEL: Record<string, string> = {
  programado: "Programado",
  abordando: "Abordando",
  despegado: "Despegado",
  aterrizado: "Aterrizado",
  retrasado: "Retrasado",
  cancelado: "Cancelado",
}

/** Map estado → clases de color para la badge */
const ESTADO_CLASSES: Record<
  string,
  { badge: string; bar: string }
> = {
  programado: {
    badge: "bg-primary/10 text-primary",
    bar: "bg-primary",
  },
  abordando: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
    bar: "bg-blue-500",
  },
  despegado: {
    badge:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400",
    bar: "bg-indigo-500",
  },
  aterrizado: {
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  retrasado: {
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  cancelado: {
    badge: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
    bar: "bg-red-500",
  },
}

const DEFAULT_CLASSES = {
  badge: "bg-muted text-muted-foreground",
  bar: "bg-muted-foreground",
}

export function EstadoBreakdown({ estados }: EstadoBreakdownProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Vuelos por estado
      </h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Distribución operativa de los {estados.reduce((acc, e) => acc + e.cantidad_vuelos, 0).toLocaleString("es-AR")} vuelos en catálogo
      </p>

      {estados.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          No hay datos de estado disponibles.
        </p>
      ) : (
        <ul
          role="list"
          className="flex flex-col gap-3"
          aria-label="Distribución de vuelos por estado operativo"
        >
          {estados.map((e) => {
            const classes = ESTADO_CLASSES[e.estado] ?? DEFAULT_CLASSES
            const label = ESTADO_LABEL[e.estado] ?? e.estado

            return (
              <li key={e.estado} className="flex items-center gap-3">
                {/* Estado badge */}
                <span
                  className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium ${classes.badge}`}
                >
                  {label}
                </span>

                {/* Bar track */}
                <div
                  className="relative h-5 flex-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={e.pct_total}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${label}: ${e.pct_total}% de los vuelos (${e.cantidad_vuelos.toLocaleString("es-AR")} vuelos)`}
                >
                  <div
                    className={`h-full rounded-full transition-all ${classes.bar}`}
                    style={{ width: `${Math.max(e.pct_total, 0.5)}%` }}
                  />
                </div>

                {/* Count */}
                <span className="w-14 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">
                  {e.cantidad_vuelos.toLocaleString("es-AR")}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
