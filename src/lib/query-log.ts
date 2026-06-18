/**
 * Query log for the dev/demo SQL query inspector (the drawer).
 *
 * Storage backend is chosen at runtime:
 *   - REDIS_URL present → Redis list, SHARED across every serverless instance.
 *     Required on Vercel: each request can hit a different function instance, so
 *     in-memory state grabbed by a Server Action is invisible to the later
 *     `GET /api/query-log` request — the drawer would always look empty.
 *   - REDIS_URL absent → in-memory ring on globalThis. Fine for local
 *     `next dev`, which is a single long-running process.
 *
 * Toggle: NEXT_PUBLIC_QUERY_LOG overrides the default.
 *   "true"  → always on (useful for a production demo)
 *   "false" → always off
 *   unset   → on outside production (the original dev-only behavior)
 * NEXT_PUBLIC_ is inlined at build time, so set it before `npm run build`
 * if you want it active in a production build.
 */

import Redis from "ioredis";

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

const queryLogFlag = process.env.NEXT_PUBLIC_QUERY_LOG;
export const QUERY_LOG_ENABLED: boolean =
  queryLogFlag === "true"
    ? true
    : queryLogFlag === "false"
      ? false
      : process.env.NODE_ENV !== "production";

// ─── Backend selection ──────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL;

// Redis keys (namespaced so they never collide with app data on a shared DB).
const K_ENTRIES = "aeroreserva:querylog:entries";
const K_ID = "aeroreserva:querylog:idseq";
const K_TX = "aeroreserva:querylog:txseq";

interface MemState {
  nextId: number;
  nextTx: number;
  buffer: QueryLogEntry[];
}

// Both the Redis client and the in-memory fallback are cached on globalThis so
// Next.js hot-reload (dev) and warm serverless instances (prod) reuse them
// instead of reconnecting / resetting on every request.
const g = globalThis as unknown as {
  __queryLogRedis?: Redis | null;
  __queryLogMem?: MemState;
};

function getRedis(): Redis | null {
  if (!REDIS_URL) return null;
  if (g.__queryLogRedis !== undefined) return g.__queryLogRedis;

  try {
    const client = new Redis(REDIS_URL, {
      // Railway's internal hostname (*.railway.internal) only resolves over
      // IPv6, so let DNS pick either family there; the public proxy is IPv4.
      family: REDIS_URL.includes(".railway.internal") ? 0 : 4,
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      enableOfflineQueue: true,
    });
    // A connection blip must never crash the Node process.
    client.on("error", () => undefined);
    g.__queryLogRedis = client;
  } catch {
    g.__queryLogRedis = null;
  }
  return g.__queryLogRedis;
}

function getMem(): MemState {
  if (!g.__queryLogMem) {
    g.__queryLogMem = { nextId: 1, nextTx: 1, buffer: [] };
  }
  return g.__queryLogMem;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function buildEntry(
  id: number,
  input: {
    txId: number | null;
    sql: string;
    params?: readonly unknown[];
    durationMs: number;
    rowCount: number | null;
    error: string | null;
  },
): QueryLogEntry {
  return {
    id,
    txId: input.txId,
    kind: deriveKind(input.sql),
    sql: input.sql.trim(),
    params: input.params ? [...input.params] : [],
    durationMs: input.durationMs,
    rowCount: input.rowCount,
    error: input.error,
    startedAt: new Date().toISOString(),
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Allocate the next transaction id. Globally unique via Redis INCR so two
 * serverless instances never produce the same txId (which would make the
 * drawer merge unrelated transactions into one group).
 */
export async function nextTxId(): Promise<number | null> {
  if (!QUERY_LOG_ENABLED) return null;

  const redis = getRedis();
  if (redis) {
    try {
      return await redis.incr(K_TX);
    } catch {
      return null;
    }
  }
  return getMem().nextTx++;
}

/**
 * Record one executed query. Never throws and never rejects — logging must not
 * break the real query. Callers should `await` it so the write completes before
 * the (serverless) request returns; otherwise the instance may freeze first.
 */
export async function recordQuery(input: {
  txId: number | null;
  sql: string;
  params?: readonly unknown[];
  durationMs: number;
  rowCount: number | null;
  error: string | null;
}): Promise<void> {
  if (!QUERY_LOG_ENABLED) return;

  try {
    const redis = getRedis();
    if (redis) {
      const id = await redis.incr(K_ID);
      const entry = buildEntry(id, input);
      await redis
        .multi()
        .rpush(K_ENTRIES, JSON.stringify(entry))
        .ltrim(K_ENTRIES, -RING_CAPACITY, -1)
        .exec();
      return;
    }

    const mem = getMem();
    const entry = buildEntry(mem.nextId++, input);
    mem.buffer.push(entry);
    if (mem.buffer.length > RING_CAPACITY) mem.buffer.shift();
  } catch {
    // swallow — a failed log entry must never surface to the caller
  }
}

/**
 * Return the current buffer, oldest→newest (the order the drawer expects).
 */
export async function getSnapshot(): Promise<QueryLogEntry[]> {
  if (!QUERY_LOG_ENABLED) return [];

  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.lrange(K_ENTRIES, 0, -1);
      return raw
        .map((s) => JSON.parse(s) as QueryLogEntry)
        .sort((a, b) => a.id - b.id);
    } catch {
      return [];
    }
  }
  return [...getMem().buffer];
}
