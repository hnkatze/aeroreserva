import { query } from "@/lib/db";

export interface Aeropuerto {
  codigo: string;
  nombre: string;
  ciudad: string;
}

/**
 * Return the airports that appear as origin or destination in the vuelos table,
 * resolved against the real `aeropuertos` catalog so callers get the city and
 * full airport name — not just the IATA code. Only airports with at least one
 * flight are returned, so the selects stay short. Ordered by city.
 */
export async function listarAeropuertos(): Promise<Aeropuerto[]> {
  return query<Aeropuerto>(
    `SELECT ap.codigo, ap.nombre, ap.ciudad
       FROM aeropuertos ap
      WHERE ap.codigo IN (
        SELECT origen FROM vuelos
        UNION
        SELECT destino FROM vuelos
      )
      ORDER BY ap.ciudad ASC, ap.codigo ASC`,
  );
}
