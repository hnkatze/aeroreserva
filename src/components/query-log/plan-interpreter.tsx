"use client"

// ---------------------------------------------------------------------------
// Plan interpreter — turns a raw PostgreSQL EXPLAIN plan (English, as the
// engine emits it) into a Spanish reading: it labels the key plan nodes with a
// traffic-light level and a short explanation, plus a human verdict. The raw
// plan stays visible above this for technical authenticity; this layer teaches
// how to read it.
// ---------------------------------------------------------------------------

export type NivelNodo = "bueno" | "advertencia" | "malo" | "neutro"

export interface NodoDetectado {
  tipo: string // original plan-node name, e.g. "Index Scan"
  etiqueta: string // Spanish label
  nivel: NivelNodo
  explicacion: string
}

export interface InterpretacionPlan {
  nodos: NodoDetectado[]
  resumen: string
  nivelGlobal: NivelNodo
  /** Real execution time (only present when the plan was run with ANALYZE). */
  tiempoEjecucionMs: number | null
  /** Row count at the top node; `estimadas` marks whether it is an estimate. */
  filas: number | null
  filasEstimadas: boolean
}

// Order matters: longer / more specific names first so "Index Only Scan" is
// matched before "Index Scan", and "Bitmap Heap Scan" before a bare "Scan".
interface ReglaNodo {
  re: RegExp
  tipo: string
  etiqueta: string
  nivel: NivelNodo
  explicacion: string
}

const REGLAS: readonly ReglaNodo[] = [
  {
    re: /Index Only Scan/i,
    tipo: "Index Only Scan",
    etiqueta: "Escaneo solo de índice",
    nivel: "bueno",
    explicacion:
      "Responde usando únicamente el índice, sin leer la tabla. Es lo más eficiente.",
  },
  {
    re: /Index Scan/i,
    tipo: "Index Scan",
    etiqueta: "Escaneo por índice",
    nivel: "bueno",
    explicacion:
      "Usa un índice para ir directo a las filas que cumplen el filtro. Eficiente.",
  },
  {
    re: /Bitmap Heap Scan/i,
    tipo: "Bitmap Heap Scan",
    etiqueta: "Escaneo de tabla por mapa de bits",
    nivel: "neutro",
    explicacion:
      "Usa un índice para marcar las filas candidatas y luego las lee de la tabla. Útil para filtros medianamente selectivos.",
  },
  {
    re: /Bitmap Index Scan/i,
    tipo: "Bitmap Index Scan",
    etiqueta: "Escaneo de índice por mapa de bits",
    nivel: "bueno",
    explicacion:
      "Recorre el índice construyendo un mapa de bits con las coincidencias antes de tocar la tabla.",
  },
  {
    re: /Seq Scan/i,
    tipo: "Seq Scan",
    etiqueta: "Escaneo secuencial",
    nivel: "advertencia",
    explicacion:
      "Lee la tabla COMPLETA fila por fila. En tablas grandes es lento; suele indicar que falta un índice o que el filtro no es selectivo.",
  },
  {
    re: /Hash Join/i,
    tipo: "Hash Join",
    etiqueta: "Unión por hash",
    nivel: "neutro",
    explicacion:
      "Construye una tabla hash de una relación y la cruza con la otra. Buena opción para unir conjuntos grandes sin orden previo.",
  },
  {
    re: /Nested Loop/i,
    tipo: "Nested Loop",
    etiqueta: "Bucle anidado",
    nivel: "neutro",
    explicacion:
      "Por cada fila de una tabla busca coincidencias en la otra. Eficiente si la tabla interna está indexada y hay pocas filas.",
  },
  {
    re: /Merge Join/i,
    tipo: "Merge Join",
    etiqueta: "Unión por mezcla",
    nivel: "neutro",
    explicacion: "Une dos entradas que ya vienen ordenadas por la clave de unión.",
  },
  {
    re: /HashAggregate/i,
    tipo: "HashAggregate",
    etiqueta: "Agregación por hash",
    nivel: "neutro",
    explicacion: "Agrupa filas (GROUP BY) usando una tabla hash.",
  },
  {
    re: /GroupAggregate/i,
    tipo: "GroupAggregate",
    etiqueta: "Agregación por grupo",
    nivel: "neutro",
    explicacion: "Agrupa filas previamente ordenadas (GROUP BY).",
  },
  {
    re: /Aggregate/i,
    tipo: "Aggregate",
    etiqueta: "Agregación",
    nivel: "neutro",
    explicacion: "Calcula funciones de agregado como COUNT, SUM o AVG.",
  },
  {
    re: /\bSort\b/i,
    tipo: "Sort",
    etiqueta: "Ordenamiento",
    nivel: "advertencia",
    explicacion:
      "Ordena el resultado (ORDER BY). Si el volumen es grande puede recurrir a disco; un índice ordenado puede evitarlo.",
  },
  {
    re: /\bLimit\b/i,
    tipo: "Limit",
    etiqueta: "Límite",
    nivel: "neutro",
    explicacion: "Corta el número de filas devueltas (LIMIT).",
  },
  {
    re: /Gather/i,
    tipo: "Gather",
    etiqueta: "Recolección paralela",
    nivel: "neutro",
    explicacion: "Combina los resultados de varios procesos (workers) en paralelo.",
  },
  {
    re: /\bHash\b/i,
    tipo: "Hash",
    etiqueta: "Construcción de tabla hash",
    nivel: "neutro",
    explicacion: "Construye la tabla hash que luego consume un Hash Join.",
  },
]

/**
 * Parse a raw EXPLAIN plan (FORMAT TEXT) into a Spanish interpretation.
 * Detects the distinct plan nodes present, extracts execution time / row count
 * when available, and produces a verdict.
 */
export function interpretarPlan(plan: string): InterpretacionPlan {
  const lineas = plan.split("\n")

  // Detect distinct nodes (first matching rule per line; de-duplicate by tipo).
  const vistos = new Set<string>()
  const nodos: NodoDetectado[] = []
  for (const linea of lineas) {
    for (const regla of REGLAS) {
      if (regla.re.test(linea)) {
        if (!vistos.has(regla.tipo)) {
          vistos.add(regla.tipo)
          nodos.push({
            tipo: regla.tipo,
            etiqueta: regla.etiqueta,
            nivel: regla.nivel,
            explicacion: regla.explicacion,
          })
        }
        break // one node per line
      }
    }
  }

  // Execution time (only with ANALYZE).
  const execMatch = /Execution Time:\s*([\d.]+)\s*ms/i.exec(plan)
  const tiempoEjecucionMs = execMatch ? Number(execMatch[1]) : null

  // Row count: prefer real ("actual time=… rows=N"), else the first estimate.
  const realRows = /actual time=[\d.]+\.\.[\d.]+ rows=(\d+)/i.exec(plan)
  const estRows = /rows=(\d+)/i.exec(plan)
  let filas: number | null = null
  let filasEstimadas = false
  if (realRows) {
    filas = Number(realRows[1])
  } else if (estRows) {
    filas = Number(estRows[1])
    filasEstimadas = true
  }

  // Global level + verdict.
  const tieneSeqScan = nodos.some((n) => n.tipo === "Seq Scan")
  const tieneIndice = nodos.some(
    (n) => n.tipo === "Index Scan" || n.tipo === "Index Only Scan" || n.tipo === "Bitmap Index Scan",
  )

  let nivelGlobal: NivelNodo
  if (tieneSeqScan) nivelGlobal = "advertencia"
  else if (tieneIndice) nivelGlobal = "bueno"
  else nivelGlobal = "neutro"

  const partes: string[] = []
  if (nivelGlobal === "bueno") {
    partes.push("Plan eficiente: la consulta se resuelve con índices.")
  } else if (nivelGlobal === "advertencia") {
    partes.push(
      "Hay un escaneo secuencial: PostgreSQL lee la tabla completa. En una tabla grande, un índice sobre la columna del filtro lo aceleraría.",
    )
  } else {
    partes.push("Plan estándar para esta consulta.")
  }
  if (tiempoEjecucionMs !== null) {
    partes.push(`Ejecutó en ${tiempoEjecucionMs} ms.`)
  }
  if (filas !== null) {
    partes.push(
      `${filas} fila${filas !== 1 ? "s" : ""} ${filasEstimadas ? "estimadas" : "reales"}.`,
    )
  }
  const resumen = partes.join(" ")

  return { nodos, resumen, nivelGlobal, tiempoEjecucionMs, filas, filasEstimadas }
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

const NIVEL_PUNTO: Record<NivelNodo, string> = {
  bueno: "bg-emerald-500",
  advertencia: "bg-amber-500",
  malo: "bg-red-500",
  neutro: "bg-slate-400",
}

// Text label so meaning never relies on color alone (a11y).
const NIVEL_TEXTO: Record<NivelNodo, string> = {
  bueno: "eficiente",
  advertencia: "atención",
  malo: "lento",
  neutro: "neutro",
}

const NIVEL_RESUMEN: Record<NivelNodo, string> = {
  bueno:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  advertencia:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  malo: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
  neutro:
    "border-border bg-muted/50 text-muted-foreground",
}

export function PlanInterpretacion({ plan }: { plan: string }) {
  const { nodos, resumen, nivelGlobal } = interpretarPlan(plan)

  if (nodos.length === 0) return null

  return (
    <section
      className="mt-1.5 flex flex-col gap-1.5"
      aria-label="Interpretación del plan de ejecución en español"
    >
      {/* Verdict */}
      <p
        className={`rounded-md border px-2.5 py-1.5 text-[0.7rem] leading-relaxed ${NIVEL_RESUMEN[nivelGlobal]}`}
      >
        <span className="font-semibold">Lectura: </span>
        {resumen}
      </p>

      {/* Detected nodes */}
      <ul className="flex flex-col gap-1" aria-label="Operaciones detectadas en el plan">
        {nodos.map((nodo) => (
          <li
            key={nodo.tipo}
            className="flex items-start gap-2 rounded-md border border-border bg-card px-2 py-1.5"
          >
            <span
              className={`mt-1 size-2 shrink-0 rounded-full ${NIVEL_PUNTO[nodo.nivel]}`}
              aria-hidden="true"
            />
            <span className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[0.72rem] font-semibold text-foreground">
                  {nodo.etiqueta}
                </span>
                <span className="font-mono text-[0.6rem] text-muted-foreground">
                  {nodo.tipo}
                </span>
                <span className="sr-only">({NIVEL_TEXTO[nodo.nivel]})</span>
              </span>
              <span className="text-[0.68rem] leading-relaxed text-muted-foreground">
                {nodo.explicacion}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
