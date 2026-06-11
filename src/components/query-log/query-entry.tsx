"use client"

import { useState } from "react"
import { ChevronDownIcon, ChevronRightIcon, ZapIcon } from "lucide-react"
import type { QueryLogEntry, QueryKind } from "@/lib/query-log"
import { Button } from "@/components/ui/button"
import { highlightSql, highlightExplain } from "./sql-highlight"
import { PlanInterpretacion } from "./plan-interpreter"

// ─── Kind badge ────────────────────────────────────────────────────────────

const KIND_STYLES: Record<QueryKind, string> = {
  SELECT:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  INSERT:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
  UPDATE:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  DELETE:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  BEGIN:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  COMMIT:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  ROLLBACK:
    "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
  OTHER:
    "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
}

function KindBadge({ kind }: { kind: QueryKind }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider ${KIND_STYLES[kind]}`}
    >
      {kind}
    </span>
  )
}

// ─── Duration chip ─────────────────────────────────────────────────────────

function DurationChip({ ms }: { ms: number }) {
  const cls =
    ms > 200
      ? "text-red-600 dark:text-red-400 font-semibold"
      : ms > 50
        ? "text-amber-600 dark:text-amber-400 font-medium"
        : "text-muted-foreground"
  return <span className={`font-mono text-[0.7rem] ${cls}`}>{ms}ms</span>
}

// ─── Params chips ─────────────────────────────────────────────────────────

function ParamChips({ params }: { params: unknown[] }) {
  if (params.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {params.map((p, i) => (
        <span
          key={i}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground"
        >
          ${i + 1}={String(p)}
        </span>
      ))}
    </div>
  )
}

// ─── EXPLAIN section ───────────────────────────────────────────────────────

type ExplainState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; plan: string }
  | { status: "error"; message: string }

function ExplainSection({
  sql,
  params,
}: {
  sql: string
  params: unknown[]
}) {
  const [state, setState] = useState<ExplainState>({ status: "idle" })
  const [open, setOpen] = useState(false)

  async function runExplain() {
    setState({ status: "loading" })
    setOpen(true)
    try {
      const res = await fetch("/api/query-log/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, params }),
      })
      const data: unknown = await res.json()
      if (
        typeof data === "object" &&
        data !== null &&
        "plan" in data &&
        typeof (data as Record<string, unknown>).plan === "string"
      ) {
        setState({ status: "success", plan: (data as { plan: string }).plan })
      } else if (
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as Record<string, unknown>).error === "string"
      ) {
        setState({
          status: "error",
          message: (data as { error: string }).error,
        })
      } else {
        setState({ status: "error", message: "Unexpected response from server" })
      }
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      })
    }
  }

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="xs"
          onClick={state.status === "idle" ? runExplain : () => setOpen((v) => !v)}
          aria-label={
            state.status === "idle"
              ? "Ejecutar EXPLAIN para esta consulta"
              : open
                ? "Ocultar plan de ejecución"
                : "Mostrar plan de ejecución"
          }
          aria-expanded={state.status !== "idle" ? open : undefined}
          aria-controls="explain-panel"
          className="h-5 gap-1 px-1.5 text-[0.65rem] font-medium"
        >
          <ZapIcon className="size-2.5" aria-hidden="true" />
          {state.status === "loading"
            ? "Cargando…"
            : state.status === "idle"
              ? "EXPLAIN"
              : open
                ? "Ocultar plan"
                : "Mostrar plan"}
        </Button>
        {state.status !== "idle" && state.status !== "loading" && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Contraer plan" : "Expandir plan"}
            className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {open ? (
              <ChevronDownIcon className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronRightIcon className="size-3.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {open && state.status === "success" && (
        <>
          <pre
            id="explain-panel"
            className="mt-1.5 overflow-x-auto rounded-md border border-border bg-muted/50 p-2.5 font-mono text-[0.65rem] leading-relaxed whitespace-pre"
            aria-label="Plan de ejecución de la consulta (PostgreSQL)"
          >
            {highlightExplain(state.plan)}
          </pre>
          <PlanInterpretacion plan={state.plan} />
        </>
      )}

      {open && state.status === "error" && (
        <p
          role="alert"
          className="mt-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[0.7rem] text-destructive"
        >
          {state.message}
        </p>
      )}
    </div>
  )
}

// ─── Single query row ─────────────────────────────────────────────────────

interface QueryEntryProps {
  entry: QueryLogEntry
  /** If true, renders a slightly tighter style (inside a tx group card) */
  compact?: boolean
}

export function QueryEntry({ entry, compact = false }: QueryEntryProps) {
  const rowCountLabel =
    entry.rowCount !== null ? `${entry.rowCount} fila${entry.rowCount !== 1 ? "s" : ""}` : null

  return (
    <div
      className={`flex flex-col gap-1 ${compact ? "py-2" : "rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm"}`}
    >
      {/* Top line: kind badge + duration + row count + timestamp */}
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={entry.kind} />
        <DurationChip ms={entry.durationMs} />
        {rowCountLabel && (
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            {rowCountLabel}
          </span>
        )}
        <span className="ml-auto font-mono text-[0.6rem] text-muted-foreground/60">
          {new Date(entry.startedAt).toLocaleTimeString("es-HN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
          })}
        </span>
      </div>

      {/* SQL block */}
      <pre
        className="overflow-x-auto rounded-md bg-muted/60 px-2.5 py-2 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap break-all dark:bg-muted/30"
        aria-label="Consulta SQL"
      >
        {highlightSql(entry.sql)}
      </pre>

      {/* Params */}
      <ParamChips params={entry.params} />

      {/* Error */}
      {entry.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[0.7rem] text-destructive"
        >
          {entry.error}
        </p>
      )}

      {/* EXPLAIN — only for SELECT / INSERT / UPDATE / DELETE */}
      {["SELECT", "INSERT", "UPDATE", "DELETE"].includes(entry.kind) && (
        <ExplainSection sql={entry.sql} params={entry.params} />
      )}
    </div>
  )
}

// ─── Transaction group card ───────────────────────────────────────────────

interface TxGroupProps {
  txId: number
  entries: QueryLogEntry[]
}

export function TxGroup({ txId, entries }: TxGroupProps) {
  const [expanded, setExpanded] = useState(true)
  const totalMs = entries.reduce((sum, e) => sum + e.durationMs, 0)
  const hasError = entries.some((e) => e.error !== null)
  const isRolledBack = entries.some((e) => e.kind === "ROLLBACK")

  const headerBorderClass = isRolledBack
    ? "border-purple-400 dark:border-purple-600"
    : hasError
      ? "border-destructive/60"
      : "border-emerald-400 dark:border-emerald-600"

  return (
    <div
      className={`rounded-lg border bg-card shadow-sm ${headerBorderClass} overflow-hidden`}
      role="region"
      aria-label={`Transacción #${txId} — ${entries.length} consultas`}
    >
      {/* Group header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`tx-group-${txId}`}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {expanded ? (
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRightIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <span className="font-mono text-xs font-semibold text-foreground">
          Transacción #{txId}
        </span>
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
          {entries.length} consulta{entries.length !== 1 ? "s" : ""}
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">
          {totalMs}ms total
        </span>
        {isRolledBack && (
          <span className="ml-auto rounded border border-purple-300 bg-purple-100 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-purple-700 dark:border-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
            ROLLBACK
          </span>
        )}
        {hasError && !isRolledBack && (
          <span className="ml-auto rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-destructive">
            ERROR
          </span>
        )}
      </button>

      {/* Queries list */}
      {expanded && (
        <div
          id={`tx-group-${txId}`}
          className="divide-y divide-border/60 px-3 pb-2"
        >
          {entries.map((e) => (
            <QueryEntry key={e.id} entry={e} compact />
          ))}
        </div>
      )}
    </div>
  )
}
