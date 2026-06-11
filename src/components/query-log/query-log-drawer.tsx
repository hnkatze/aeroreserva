"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DatabaseIcon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react"
import type { QueryLogEntry } from "@/lib/query-log"
import { Button } from "@/components/ui/button"
import { QueryEntry, TxGroup } from "./query-entry"

// ─── Types ─────────────────────────────────────────────────────────────────

/** A display item is either a standalone entry or a transaction group. */
type DisplayItem =
  | { kind: "standalone"; entry: QueryLogEntry }
  | { kind: "tx"; txId: number; entries: QueryLogEntry[] }

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Groups a flat list of entries (newest-first) into display items.
 * Consecutive entries sharing the same non-null txId form one group.
 * We walk the list in REVERSE (oldest→newest) to accumulate groups correctly,
 * then reverse the result so the display is newest-first.
 */
function buildDisplayItems(entries: QueryLogEntry[]): DisplayItem[] {
  const ordered = [...entries].reverse() // entries are newest-first → work oldest-first

  const items: DisplayItem[] = []
  const txMap = new Map<number, QueryLogEntry[]>()

  for (const entry of ordered) {
    if (entry.txId === null) {
      items.push({ kind: "standalone", entry })
    } else {
      if (!txMap.has(entry.txId)) {
        const group: QueryLogEntry[] = []
        txMap.set(entry.txId, group)
        items.push({ kind: "tx", txId: entry.txId, entries: group })
      }
      txMap.get(entry.txId)!.push(entry)
    }
  }

  return items.reverse() // newest items at the top
}

function countTransactions(entries: QueryLogEntry[]): number {
  const txIds = new Set<number>()
  for (const e of entries) {
    if (e.txId !== null) txIds.add(e.txId)
  }
  return txIds.size
}

// ─── FAB badge ────────────────────────────────────────────────────────────

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span
      aria-label={`${count} transacciones registradas`}
      className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand-accent text-[0.55rem] font-bold text-brand-accent-foreground"
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function QueryLogDrawer() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<QueryLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // ── Fetch the on-demand snapshot ────────────────────────────────────────

  const fetchLog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/query-log", { cache: "no-store" })
      if (!res.ok) return
      const data: unknown = await res.json()
      if (
        typeof data === "object" &&
        data !== null &&
        "entries" in data &&
        Array.isArray((data as { entries: unknown }).entries)
      ) {
        // Snapshot arrives oldest→newest; store newest-first for display.
        const list = (data as { entries: QueryLogEntry[] }).entries
        setEntries([...list].reverse())
      }
    } catch {
      // network error — keep whatever we had
    } finally {
      setLoading(false)
    }
  }, [])

  // Load the snapshot whenever the panel opens.
  useEffect(() => {
    if (open) void fetchLog()
  }, [open, fetchLog])

  // ── Keyboard: Escape closes the panel when focus is inside ─────────────

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && panelRef.current?.contains(document.activeElement)) {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open])

  // ── Derived ────────────────────────────────────────────────────────────

  const displayItems = buildDisplayItems(entries)
  const txCount = countTransactions(entries)

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── FAB ──────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir registro de consultas SQL"
          aria-pressed={open}
          className="relative flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 motion-reduce:transition-none"
        >
          <DatabaseIcon className="size-5" aria-hidden="true" />
          <CountBadge count={txCount} />
        </button>
      </div>

      {/* ── Panel (fixed, non-modal — app stays interactive underneath) ── */}
      <div
        ref={panelRef}
        role="complementary"
        aria-label="Registro de consultas SQL"
        aria-hidden={!open}
        className={[
          "fixed right-0 top-0 z-50 flex h-screen w-[30rem] max-w-[92vw] flex-col",
          "border-l border-border bg-card shadow-2xl",
          "transition-transform duration-300 ease-in-out motion-reduce:transition-none",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <DatabaseIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold leading-none text-foreground">
              Transacciones SQL
            </h2>
            <p className="mt-0.5 text-[0.65rem] text-muted-foreground" aria-live="polite">
              {txCount === 0
                ? "Sin transacciones"
                : `${txCount} transacci${txCount !== 1 ? "ones" : "ón"} · ${entries.length} consulta${entries.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1" role="toolbar" aria-label="Controles del registro">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void fetchLog()}
              disabled={loading}
              aria-label="Actualizar lista de transacciones"
            >
              <RefreshCwIcon
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEntries([])}
              aria-label="Limpiar lista de transacciones"
            >
              <Trash2Icon className="size-3.5" aria-hidden="true" />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label="Cerrar registro de consultas"
            >
              <XIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" tabIndex={-1} aria-label="Lista de transacciones SQL">
          {displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <DatabaseIcon className="size-8 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">No hay transacciones registradas</p>
              <p className="max-w-[18rem] text-xs text-muted-foreground/60">
                Hacé una reserva, una cancelación o encolá un pasajero para ver acá la
                transacción completa (BEGIN → FOR UPDATE → INSERT → COMMIT). Tocá{" "}
                <span className="font-medium">Actualizar</span> para refrescar.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3" role="list" aria-label="Transacciones SQL">
              {displayItems.map((item) =>
                item.kind === "tx" ? (
                  <div key={`tx-${item.txId}`} role="listitem">
                    <TxGroup txId={item.txId} entries={item.entries} />
                  </div>
                ) : (
                  <div key={`entry-${item.entry.id}`} role="listitem">
                    <QueryEntry entry={item.entry} />
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-border px-4 py-2">
          <p className="text-center text-[0.6rem] text-muted-foreground/50">
            Dev-only · AeroReserva Query Inspector
          </p>
        </footer>
      </div>
    </>
  )
}
