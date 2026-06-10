import { Pool, type PoolClient, type QueryResultRow } from "pg";

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
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as unknown[]);
  return result.rows;
}

/**
 * Run a unit of work inside a single transaction. The callback receives a
 * dedicated client; the transaction commits if it resolves and rolls back if
 * it throws. This is the backbone of the project: reservations, mass
 * cancellations and waitlist promotion all rely on explicit
 * BEGIN / SELECT ... FOR UPDATE / COMMIT semantics.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
