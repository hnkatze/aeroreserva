import { query } from "@/lib/db";

export interface Vuelo {
  id: number;
  codigo: string;
  origen: string;
  destino: string;
  salida: Date;
  llegada: Date;
}

/**
 * Return all flights ordered by departure time.
 */
export async function listarVuelos(): Promise<Vuelo[]> {
  return query<Vuelo>(
    `SELECT id, codigo, origen, destino, salida, llegada
       FROM vuelos
      ORDER BY salida ASC`,
  );
}
