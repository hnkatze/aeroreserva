/**
 * In-memory query log for the dev/demo SQL query inspector.
 * Cached on globalThis so Next.js hot-reload does not reset the buffer.
 * All exports are no-ops when QUERY_LOG_ENABLED is false.
 *
 * Toggle: NEXT_PUBLIC_QUERY_LOG overrides the default.
 *   "true"  → always on (useful for a production demo)
 *   "false" → always off
 *   unset   → on outside production (the original dev-only behavior)
 * NEXT_PUBLIC_ is inlined at build time, so set it before `npm run build`
 * if you want it active in a production build.
 */

export type QueryKind =
  | "SELECT"
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "BEGIN"
  | "COMMIT"
  | "ROLLBACK"
  | "OTHER";

export interface QueryLogEntry {
  id: number;
  txId: number | null;
  kind: QueryKind;
  sql: string;
  params: unknown[];
  durationMs: number;
  rowCount: number | null;
  error: string | null;
  startedAt: string;
}

const RING_CAPACITY = 200;

interface QueryLogState {
  nextId: number;
  nextTxIdCounter: number;
  buffer: QueryLogEntry[];
  subscribers: Set<(entry: QueryLogEntry) => void>;
}

const g = globalThis as unknown as { __queryLog?: QueryLogState };

function getState(): QueryLogState {
  if (!g.__queryLog) {
    g.__queryLog = {
      nextId: 1,
      nextTxIdCounter: 1,
      buffer: [],
      subscribers: new Set(),
    };
  }
  return g.__queryLog;
}

const queryLogFlag = process.env.NEXT_PUBLIC_QUERY_LOG;
export const QUERY_LOG_ENABLED: boolean =
  queryLogFlag === "true"
    ? true
    : queryLogFlag === "false"
      ? false
      : process.env.NODE_ENV !== "production";

function deriveKind(sql: string): QueryKind {
  const first = sql.trimStart().split(/\s+/)[0]?.toUpperCase() ?? "";
  switch (first) {
    case "SELECT":
      return "SELECT";
    case "INSERT":
      return "INSERT";
    case "UPDATE":
      return "UPDATE";
    case "DELETE":
      return "DELETE";
    case "BEGIN":
      return "BEGIN";
    case "COMMIT":
      return "COMMIT";
    case "ROLLBACK":
      return "ROLLBACK";
    default:
      return "OTHER";
  }
}

export function recordQuery(input: {
  txId: number | null;
  sql: string;
  params?: readonly unknown[];
  durationMs: number;
  rowCount: number | null;
  error: string | null;
}): void {
  if (!QUERY_LOG_ENABLED) return;

  const state = getState();

  const entry: QueryLogEntry = {
    id: state.nextId++,
    txId: input.txId,
    kind: deriveKind(input.sql),
    sql: input.sql.trim(),
    params: input.params ? [...input.params] : [],
    durationMs: input.durationMs,
    rowCount: input.rowCount,
    error: input.error,
    startedAt: new Date().toISOString(),
  };

  if (state.buffer.length >= RING_CAPACITY) {
    state.buffer.shift();
  }
  state.buffer.push(entry);

  for (const fn of state.subscribers) {
    try {
      fn(entry);
    } catch {
      // subscriber errors must not crash the caller
    }
  }
}

export function nextTxId(): number {
  if (!QUERY_LOG_ENABLED) return 0;
  const state = getState();
  return state.nextTxIdCounter++;
}

export function getSnapshot(): QueryLogEntry[] {
  if (!QUERY_LOG_ENABLED) return [];
  return [...getState().buffer];
}

export function subscribe(
  fn: (entry: QueryLogEntry) => void,
): () => void {
  if (!QUERY_LOG_ENABLED) return () => undefined;
  const state = getState();
  state.subscribers.add(fn);
  return () => {
    state.subscribers.delete(fn);
  };
}
