import { query } from "@/lib/db";

export interface Asiento {
  id: number;
  vuelo_id: number;
  numero: string;
  clase: string;
  estado: string;
}

/**
 * Return seats for a given flight. Pass `soloLibres: true` to filter only
 * available seats (estado = 'libre').
 */
export async function listarAsientosDeVuelo(
  vueloId: number,
  opts?: { soloLibres?: boolean },
): Promise<Asiento[]> {
  if (opts?.soloLibres) {
    return query<Asiento>(
      `SELECT id, vuelo_id, numero, clase, estado
         FROM asientos
        WHERE vuelo_id = $1
          AND estado = 'libre'
        ORDER BY id ASC`,
      [vueloId],
    );
  }

  return query<Asiento>(
    `SELECT id, vuelo_id, numero, clase, estado
       FROM asientos
      WHERE vuelo_id = $1
      ORDER BY id ASC`,
    [vueloId],
  );
}
