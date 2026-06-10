import type { PoolClient } from "pg";

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
