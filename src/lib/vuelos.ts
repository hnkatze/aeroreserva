import { query } from "@/lib/db";

export interface Vuelo {
  id: number;
  codigo: string;
  origen: string;
  destino: string;
  salida: Date;
  llegada: Date;
}

export interface VuelosListOptions {
  limit?: number;
  offset?: number;
}

/**
 * Return a paginated list of flights ordered by departure time.
 * Defaults: limit = 25, offset = 0.
 */
export async function listarVuelos(opts: VuelosListOptions = {}): Promise<Vuelo[]> {
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;
  return query<Vuelo>(
    `SELECT id, codigo, origen, destino, salida, llegada
       FROM vuelos
      ORDER BY salida ASC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
}

/**
 * Return the total count of flights.
 */
export async function contarVuelos(): Promise<number> {
  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM vuelos`,
  );
  return rows[0]?.n ?? 0;
}
