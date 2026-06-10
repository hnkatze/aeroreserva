import { query } from "@/lib/db";

export interface Vuelo {
  id: number;
  codigo: string;
  origen: string;
  destino: string;
  salida: Date;
  llegada: Date;
  aerolinea_codigo: string | null;
  aerolinea_nombre: string | null;
}

export interface VuelosListOptions {
  limit?: number;
  offset?: number;
}

/**
 * Return a paginated list of flights ordered by departure time.
 * Includes airline name via LEFT JOIN with aerolineas.
 * Defaults: limit = 25, offset = 0.
 */
export async function listarVuelos(opts: VuelosListOptions = {}): Promise<Vuelo[]> {
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;
  return query<Vuelo>(
    `SELECT v.id,
            v.codigo,
            v.origen,
            v.destino,
            v.salida,
            v.llegada,
            v.aerolinea_codigo,
            a.nombre AS aerolinea_nombre
       FROM vuelos v
       LEFT JOIN aerolineas a ON a.codigo = v.aerolinea_codigo
      ORDER BY v.salida ASC
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
