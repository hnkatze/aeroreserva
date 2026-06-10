import { query } from "@/lib/db";

export type EstadoVuelo =
  | "programado"
  | "abordando"
  | "despegado"
  | "aterrizado"
  | "retrasado"
  | "cancelado";

export interface Vuelo {
  id: number;
  codigo: string;
  origen: string;
  destino: string;
  salida: Date;
  llegada: Date;
  aerolinea_codigo: string | null;
  aerolinea_nombre: string | null;
  estado: EstadoVuelo;
  retraso_min: number;
}

export interface VuelosFiltros {
  origen?: string;
  destino?: string;
  /** ISO date string yyyy-mm-dd; matches flights departing on that calendar day */
  fecha?: string;
  /** Free-text search — matches codigo, origen, or destino (case-insensitive) */
  q?: string;
}

export interface VuelosListOptions extends VuelosFiltros {
  limit?: number;
  offset?: number;
}

/**
 * Build the dynamic WHERE clause from optional filters.
 * Returns { where, params } ready to splice into the main query.
 * Starts param numbering at `startAt` so callers can append LIMIT/OFFSET.
 */
function buildWhere(
  filtros: VuelosFiltros,
  startAt = 1,
): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let n = startAt;

  if (filtros.origen) {
    clauses.push(`v.origen = $${n++}`);
    params.push(filtros.origen.toUpperCase());
  }
  if (filtros.destino) {
    clauses.push(`v.destino = $${n++}`);
    params.push(filtros.destino.toUpperCase());
  }
  if (filtros.fecha) {
    // Match any flight departing on the given calendar day (UTC date)
    clauses.push(`v.salida::date = $${n++}::date`);
    params.push(filtros.fecha);
  }
  if (filtros.q) {
    // Full-text-style search: codigo, origin IATA code, or destination IATA code
    const pattern = `%${filtros.q}%`;
    clauses.push(
      `(v.codigo ILIKE $${n} OR v.origen ILIKE $${n} OR v.destino ILIKE $${n})`,
    );
    params.push(pattern);
    n++;
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return { where, params };
}

/**
 * Return a paginated list of flights ordered by departure time.
 * Includes airline name via LEFT JOIN with aerolineas.
 * Defaults: limit = 25, offset = 0.
 *
 * Optional filters: origen, destino, fecha (yyyy-mm-dd).
 * Existing callers that only pass { limit, offset } are unaffected.
 */
export async function listarVuelos(opts: VuelosListOptions = {}): Promise<Vuelo[]> {
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  const { where, params: filterParams } = buildWhere(opts);
  // LIMIT and OFFSET come after the filter params
  const limitIdx = filterParams.length + 1;
  const offsetIdx = filterParams.length + 2;

  return query<Vuelo>(
    `SELECT v.id,
            v.codigo,
            v.origen,
            v.destino,
            v.salida,
            v.llegada,
            v.aerolinea_codigo,
            a.nombre AS aerolinea_nombre,
            v.estado,
            v.retraso_min
       FROM vuelos v
       LEFT JOIN aerolineas a ON a.codigo = v.aerolinea_codigo
      ${where}
      ORDER BY v.salida ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...filterParams, limit, offset],
  );
}

/**
 * Return the total count of flights, optionally filtered.
 * Existing callers that call contarVuelos() with no args are unaffected.
 */
export async function contarVuelos(filtros: VuelosFiltros = {}): Promise<number> {
  const { where, params } = buildWhere(filtros);
  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM vuelos v ${where}`,
    params,
  );
  return rows[0]?.n ?? 0;
}

/**
 * Find a single flight by its IATA-style code (e.g. "AR1304").
 * Returns null if not found.
 */
export async function buscarVueloPorCodigo(codigo: string): Promise<Vuelo | null> {
  const rows = await query<Vuelo>(
    `SELECT v.id,
            v.codigo,
            v.origen,
            v.destino,
            v.salida,
            v.llegada,
            v.aerolinea_codigo,
            a.nombre AS aerolinea_nombre,
            v.estado,
            v.retraso_min
       FROM vuelos v
       LEFT JOIN aerolineas a ON a.codigo = v.aerolinea_codigo
      WHERE v.codigo = $1
      LIMIT 1`,
    [codigo],
  );
  return rows[0] ?? null;
}
