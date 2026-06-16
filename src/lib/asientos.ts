import { query } from "@/lib/db";

export interface Asiento {
  id: number;
  vuelo_id: number;
  numero: string;
  clase: string;
  estado: string;
  /** Passenger holding the confirmed reservation — null when the seat is free. */
  pasajero_nombre: string | null;
  pasajero_documento: string | null;
  reserva_id: number | null;
}

/**
 * Return seats for a given flight. Pass `soloLibres: true` to filter only
 * available seats (estado = 'libre').
 *
 * Each occupied seat is LEFT JOINed to its confirmed reservation and passenger
 * so the map can show who holds the seat. The partial UNIQUE index
 * `ux_reservas_vuelo_asiento` guarantees at most one confirmed reservation per
 * (vuelo, asiento), so the join never duplicates a seat row.
 */
export async function listarAsientosDeVuelo(
  vueloId: number,
  opts?: { soloLibres?: boolean },
): Promise<Asiento[]> {
  // `soloLibres` selects a constant SQL fragment from a boolean — no user input
  // is interpolated, so this is not an injection vector.
  const onlyFree = opts?.soloLibres ? "AND a.estado = 'libre'" : "";

  return query<Asiento>(
    `SELECT a.id, a.vuelo_id, a.numero, a.clase, a.estado,
            p.nombre    AS pasajero_nombre,
            p.documento AS pasajero_documento,
            r.id        AS reserva_id
       FROM asientos a
       LEFT JOIN reservas  r ON r.asiento_id = a.id AND r.estado = 'confirmada'
       LEFT JOIN pasajeros p ON p.id = r.pasajero_id
      WHERE a.vuelo_id = $1
        ${onlyFree}
      ORDER BY a.id ASC`,
    [vueloId],
  );
}
