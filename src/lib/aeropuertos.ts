import { query } from "@/lib/db";

export interface Aeropuerto {
  codigo: string;
  /** Derived from airport data or just the raw IATA code when no name exists */
  nombre: string;
}

/**
 * Return the distinct IATA airport codes that appear as origin or destination
 * in the vuelos table, sorted alphabetically.
 *
 * We derive the list from actual flight data so the selects only show airports
 * that have at least one flight — no separate airports table required.
 */
export async function listarAeropuertos(): Promise<Aeropuerto[]> {
  const rows = await query<{ codigo: string }>(
    `SELECT codigo
       FROM (
         SELECT origen AS codigo FROM vuelos
         UNION
         SELECT destino AS codigo FROM vuelos
       ) t
      ORDER BY codigo ASC`,
  );
  return rows.map((r) => ({ codigo: r.codigo, nombre: r.codigo }));
}
