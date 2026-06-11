import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { QUERY_LOG_ENABLED, nextTxId, recordQuery } from "@/lib/query-log";

// NOTE: standalone query() calls are intentionally NOT recorded in the query
// log — only queries issued inside a transaction (via withTransaction) are.
// This keeps the log focused on the meaningful units of work (reservations,
// cancellations, waitlist enqueue/promotion) instead of every page's SELECTs.

/**
 * Single shared connection pool. We cache it on `globalThis` so Next.js hot
 * reloads in development don't open a new pool on every change and exhaust
 * PostgreSQL connections.
 */
const globalForPg = globalThis as unknown as { pgPool?: Pool };

function getPool(): Pool {
  if (globalForPg.pgPool) return globalForPg.pgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and restart the dev server.",
    );
  }

  const pool = new Pool({ connectionString, max: 10 });
  globalForPg.pgPool = pool;
  return pool;
}

/**
 * Run a parameterized query and return the rows. Always pass user input via
 * `params` ($1, $2, ...) — never interpolate into the SQL string.
 *
 * Standalone queries are not recorded in the query log (see note above).
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as unknown[]);
  return result.rows;
}

/**
 * Execute a query without recording it in the query log.
 * Used internally by the EXPLAIN endpoint to avoid polluting the log.
 */
export async function queryRaw<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[]);
}

/**
 * Closed set of PostgreSQL NOLOGIN roles accepted by withTransaction.
 * Must match the roles created in migration 006_roles.sql exactly.
 * Keeping the whitelist here (not in auth.ts) lets db.ts validate without
 * importing from auth.ts, preventing a circular dependency.
 */
const ALLOWED_PG_ROLES = new Set([
  "app_consulta",
  "app_agente",
  "app_admin",
] as const);

export interface WithTransactionOpts {
  /**
   * PostgreSQL NOLOGIN role to activate for the duration of this transaction
   * via SET LOCAL ROLE.  Must be one of the roles in migration 006_roles.sql.
   * When provided, `SET LOCAL ROLE "<role>"` is issued right after BEGIN so
   * that every subsequent statement in the transaction runs under that role's
   * privilege set.  SET LOCAL automatically resets to the session role at
   * COMMIT or ROLLBACK — no cleanup code required.
   *
   * Security note: the value is validated against ALLOWED_PG_ROLES (whitelist)
   * before being interpolated into SQL.  Raw user input MUST NEVER flow here
   * directly; always go through operatorRoleToPgRole() in auth.ts first.
   */
  pgRole?: string;
}

/**
 * Run a unit of work inside a single transaction. The callback receives a
 * dedicated client; the transaction commits if it resolves and rolls back if
 * it throws. This is the backbone of the project: reservations, mass
 * cancellations and waitlist promotion all rely on explicit
 * BEGIN / SELECT ... FOR UPDATE / COMMIT semantics.
 *
 * All queries issued through the proxied client (including BEGIN/COMMIT/ROLLBACK)
 * are recorded in the query log under the same txId.
 *
 * When opts.pgRole is provided and whitelisted, `SET LOCAL ROLE "<role>"` is
 * issued immediately after BEGIN so GRANT/REVOKE from migration 006 are
 * enforced for the entire transaction.  The audit set_config call
 * (app.current_operator) works normally under SET LOCAL ROLE — session
 * variables are independent of the active role.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  opts?: WithTransactionOpts,
): Promise<T> {
  const client = await getPool().connect();
  const txId = QUERY_LOG_ENABLED ? nextTxId() : null;

  /**
   * Proxy that intercepts client.query() calls to time and record them,
   * then forwards to the real client. All other property accesses (release,
   * etc.) pass through unchanged.
   */
  const proxiedClient = new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== "query") {
        return Reflect.get(target, prop, receiver) as unknown;
      }

      return (
        textOrConfig: string,
        paramsArg?: unknown[],
      ): Promise<QueryResult> => {
        const text =
          typeof textOrConfig === "string" ? textOrConfig : String(textOrConfig);
        const start = Date.now();

        return (target.query as (t: string, p?: unknown[]) => Promise<QueryResult>)(
          text,
          paramsArg,
        ).then(
          (result) => {
            recordQuery({
              txId,
              sql: text,
              params: paramsArg,
              durationMs: Date.now() - start,
              rowCount: result.rowCount,
              error: null,
            });
            return result;
          },
          (err: unknown) => {
            recordQuery({
              txId,
              sql: text,
              params: paramsArg,
              durationMs: Date.now() - start,
              rowCount: null,
              error: String(err),
            });
            throw err;
          },
        );
      };
    },
  });

  try {
    await proxiedClient.query("BEGIN");

    // Activate the PostgreSQL NOLOGIN role for this transaction so that
    // GRANT/REVOKE from migration 006_roles.sql are enforced.
    // SET LOCAL resets automatically to the session role at COMMIT/ROLLBACK.
    //
    // Injection safety: opts.pgRole is validated against ALLOWED_PG_ROLES
    // (a closed Set of known literals) before interpolation.  Identifiers are
    // double-quoted per SQL standard so names with underscores are safe.
    // The value never comes from raw user input — it must be routed through
    // operatorRoleToPgRole() in auth.ts, which returns a narrowed union.
    if (opts?.pgRole !== undefined) {
      if (!ALLOWED_PG_ROLES.has(opts.pgRole as "app_consulta" | "app_agente" | "app_admin")) {
        throw new Error(
          `withTransaction: pgRole "${opts.pgRole}" is not in the allowed list.`,
        );
      }
      // Double-quoting the role name follows the SQL identifier quoting standard.
      // The value is already validated against the whitelist above; this is a
      // defence-in-depth measure, not the primary injection guard.
      await proxiedClient.query(`SET LOCAL ROLE "${opts.pgRole}"`);
    }

    const result = await fn(proxiedClient as PoolClient);
    await proxiedClient.query("COMMIT");
    return result;
  } catch (error) {
    await proxiedClient.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
