import type { ReactNode } from "react"

// SQL keywords grouped by semantic category → color class
const KEYWORD_GROUPS: Array<{ pattern: RegExp; className: string }> = [
  // DML verbs — blue
  {
    pattern:
      /\b(SELECT|INSERT\s+INTO|INSERT|UPDATE|DELETE\s+FROM|DELETE|VALUES|SET|RETURNING)\b/gi,
    className: "text-blue-500 dark:text-blue-400 font-semibold",
  },
  // Clauses — violet
  {
    pattern:
      /\b(FROM|WHERE|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|OFFSET|ON\s+CONFLICT)\b/gi,
    className: "text-violet-500 dark:text-violet-400 font-semibold",
  },
  // Joins — cyan
  {
    pattern: /\b(LEFT\s+JOIN|INNER\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|JOIN|ON)\b/gi,
    className: "text-cyan-600 dark:text-cyan-400 font-semibold",
  },
  // Locking / concurrency — amber (visually distinct for demo purposes)
  {
    pattern: /\b(FOR\s+UPDATE|SKIP\s+LOCKED|FOR\s+SHARE)\b/gi,
    className: "text-amber-600 dark:text-amber-400 font-bold",
  },
  // Transaction control — slate
  {
    pattern: /\b(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/gi,
    className: "text-slate-500 dark:text-slate-400 font-semibold",
  },
  // Misc — emerald
  {
    pattern:
      /\b(AS|AND|OR|NOT|IN|LIKE|ILIKE|IS|NULL|TRUE|FALSE|DISTINCT|ALL|ANY|SOME|EXISTS|BETWEEN|CASE|WHEN|THEN|ELSE|END)\b/gi,
    className: "text-emerald-600 dark:text-emerald-400",
  },
]

/**
 * Returns React nodes with SQL keywords wrapped in colored <span>s.
 * Safe — no dangerouslySetInnerHTML. Uses regex splitting to produce text
 * nodes and span nodes interleaved.
 */
export function highlightSql(sql: string): ReactNode {
  // We apply highlights one group at a time by splitting the string into
  // [plain, keyword, plain, keyword, …] segments.
  // To avoid nested replacements we walk through a single combined regex.

  // Build a single combined pattern that captures any keyword group.
  // We tag each match via a placeholder → replace pass, then split.
  // Simpler approach: split-by-regex returning alternating text / match arrays.

  // Combine all patterns into one alternation, preserving group indices.
  const combinedSource = KEYWORD_GROUPS.map((g) => `(${g.pattern.source})`).join("|")
  const combined = new RegExp(combinedSource, "gi")

  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  combined.lastIndex = 0
  while ((match = combined.exec(sql)) !== null) {
    const matchStart = match.index
    const matchEnd = matchStart + match[0].length

    // Push plain text before this match
    if (matchStart > lastIndex) {
      parts.push(sql.slice(lastIndex, matchStart))
    }

    // Determine which group matched (groups are 1-indexed; each group has
    // sub-groups from the original pattern so we check the first non-undefined
    // capture after index 0).
    let groupIndex = -1
    for (let i = 0; i < KEYWORD_GROUPS.length; i++) {
      // Each entry in KEYWORD_GROUPS contributes exactly one capturing group in
      // the combined regex. Group 1 = KEYWORD_GROUPS[0], group 2 = [1], etc.
      if (match[i + 1] !== undefined) {
        groupIndex = i
        break
      }
    }

    const className =
      groupIndex >= 0 ? KEYWORD_GROUPS[groupIndex]!.className : undefined

    parts.push(
      <span key={key++} className={className}>
        {match[0]}
      </span>
    )

    lastIndex = matchEnd
  }

  // Remaining plain text
  if (lastIndex < sql.length) {
    parts.push(sql.slice(lastIndex))
  }

  return <>{parts}</>
}

/**
 * Highlights EXPLAIN output: marks bad patterns (Seq Scan) in amber/red
 * and good patterns (Index Scan, Index Only Scan) in green.
 */
export function highlightExplain(plan: string): ReactNode {
  const lines = plan.split("\n")
  return (
    <>
      {lines.map((line, i) => {
        let lineClass: string | undefined
        if (/Seq\s+Scan/i.test(line)) {
          lineClass = "text-amber-600 dark:text-amber-400 font-medium"
        } else if (/Index\s+Only\s+Scan/i.test(line)) {
          lineClass = "text-emerald-600 dark:text-emerald-500 font-medium"
        } else if (/Index\s+Scan/i.test(line)) {
          lineClass = "text-emerald-600 dark:text-emerald-500 font-medium"
        }
        return (
          <span key={i} className={lineClass}>
            {line}
            {i < lines.length - 1 ? "\n" : ""}
          </span>
        )
      })}
    </>
  )
}
