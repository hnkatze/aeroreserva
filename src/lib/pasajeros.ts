import type { PoolClient } from "pg";
import { query } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Pasajero {
  id: number;
  documento: string;
  nombre: string;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search passengers by documento OR nombre (case-insensitive ILIKE).
 * Empty `q` returns the first `limit` rows ordered by nombre.
 * Default limit = 20; caller may override.
 */
export async function buscarPasajeros(
  q: string,
  limit = 20,
): Promise<Pasajero[]> {
  const pattern = q.trim() ? `%${q.trim()}%` : "%";
  return query<Pasajero>(
    `SELECT id, documento, nombre
     FROM pasajeros
     WHERE documento ILIKE $1 OR nombre ILIKE $1
     ORDER BY nombre
     LIMIT $2`,
    [pattern, limit],
  );
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

/**
 * Insert or update a passenger by document number.
 * Must receive the transaction client so the upsert is atomic with the
 * surrounding reservation INSERT (D3 from design).
 */
export async function upsertPasajero(
  client: PoolClient,
  input: { documento: string; nombre: string },
): Promise<{ id: number }> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO pasajeros (documento, nombre)
     VALUES ($1, $2)
     ON CONFLICT (documento) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id`,
    [input.documento, input.nombre],
  );

  const row = result.rows[0];
  if (!row) throw new Error("upsertPasajero returned no row");
  return row;
}
