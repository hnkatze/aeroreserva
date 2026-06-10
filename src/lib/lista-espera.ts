import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/db";
import { upsertPasajero } from "@/lib/pasajeros";

// ---------------------------------------------------------------------------
// Domain interface
// ---------------------------------------------------------------------------

/**
 * A denormalised waitlist entry ready for UI consumption.
 * All JOINs are resolved here so the component receives flat data.
 */
export interface EntradaListaEspera {
  id: number;
  posicion: number;
  estado: "esperando" | "promovida" | "cancelada";
  pasajero_nombre: string;
  pasajero_documento: string;
  vuelo_codigo: string;
  creado_en: Date;
}

// ---------------------------------------------------------------------------
// listarListaEspera
// ---------------------------------------------------------------------------

export interface ListarListaEsperaOpts {
  /** Also include promoted rows (estado = 'promovida'). Defaults to false. */
  incluirPromovidas?: boolean;
  /** Maximum number of records to return. Defaults to 25. */
  limit?: number;
  /** Number of records to skip. Defaults to 0. */
  offset?: number;
}

/**
 * Return a paginated list of waitlist entries (estado = 'esperando' by default)
 * ordered by flight then by position within the flight.
 *
 * Optional: pass { incluirPromovidas: true } to also include promoted rows
 * (useful for audit / reporting views).
 * Defaults: limit = 25, offset = 0.
 */
export async function listarListaEspera(
  opts: ListarListaEsperaOpts = {},
): Promise<EntradaListaEspera[]> {
  const estadoFilter = opts.incluirPromovidas
    ? `le.estado IN ('esperando', 'promovida')`
    : `le.estado = 'esperando'`;

  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  return query<EntradaListaEspera>(
    `SELECT
       le.id,
       le.posicion,
       le.estado,
       p.nombre    AS pasajero_nombre,
       p.documento AS pasajero_documento,
       v.codigo    AS vuelo_codigo,
       le.creado_en
     FROM lista_espera le
     JOIN pasajeros p ON p.id = le.pasajero_id
     JOIN vuelos    v ON v.id = le.vuelo_id
    WHERE ${estadoFilter}
    ORDER BY v.codigo, le.posicion, le.id
    LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
}

// ---------------------------------------------------------------------------
// contarListaEspera
// ---------------------------------------------------------------------------

export interface ContarListaEsperaOpts {
  /** Also count promoted rows. Defaults to false. */
  incluirPromovidas?: boolean;
}

/**
 * Return the total count of waitlist entries matching the filter.
 * Used for pagination metadata.
 */
export async function contarListaEspera(
  opts: ContarListaEsperaOpts = {},
): Promise<number> {
  const estadoFilter = opts.incluirPromovidas
    ? `estado IN ('esperando', 'promovida')`
    : `estado = 'esperando'`;

  const rows = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM lista_espera WHERE ${estadoFilter}`,
  );
  return Number(rows[0]?.total ?? 0);
}

// ---------------------------------------------------------------------------
// encolarEnEspera
// ---------------------------------------------------------------------------

/**
 * Input for adding a passenger to the waitlist.
 * If the passenger does not exist they are upserted by documento first
 * (same upsert semantics as crearReserva).
 */
export interface EncolarEnEsperaInput {
  vueloId: number;
  pasajero: { nombre: string; documento: string };
}

/**
 * Enqueue a passenger on the waitlist for the given flight.
 *
 * Atomic steps (all in a single transaction):
 *  1. Upsert the passenger by documento (creates if new, updates nombre if
 *     they already exist).
 *  2. Calculate the next posicion as MAX(posicion) + 1 for this flight.
 *  3. INSERT the lista_espera row.
 *
 * Throws a PostgreSQL 23505 unique-violation error if the passenger is
 * already waiting for this flight — the caller should surface that as a
 * user-visible message.
 *
 * Returns the newly created EntradaListaEspera (denormalised for the UI).
 */
export async function encolarEnEspera(
  input: EncolarEnEsperaInput,
): Promise<EntradaListaEspera> {
  return withTransaction(async (client: PoolClient) => {
    // Step 1: upsert passenger (reuse the shared helper from lib/pasajeros)
    const { id: pasajeroId } = await upsertPasajero(client, input.pasajero);

    // Step 2 + 3: calculate posicion and insert atomically.
    // COALESCE(MAX, 0) + 1 gives posicion = 1 when the flight has no waitlist.
    const insertResult = await client.query<{ id: number; posicion: number }>(
      `INSERT INTO lista_espera (vuelo_id, pasajero_id, posicion)
       SELECT $1, $2, COALESCE(MAX(posicion), 0) + 1
         FROM lista_espera
        WHERE vuelo_id = $1
       RETURNING id, posicion`,
      [input.vueloId, pasajeroId],
    );

    const inserted = insertResult.rows[0];
    if (!inserted) throw new Error("encolarEnEspera: INSERT returned no row");

    // Step 4: return the full denormalised row for the UI
    const rows = await client.query<EntradaListaEspera>(
      `SELECT
         le.id,
         le.posicion,
         le.estado,
         p.nombre    AS pasajero_nombre,
         p.documento AS pasajero_documento,
         v.codigo    AS vuelo_codigo,
         le.creado_en
       FROM lista_espera le
       JOIN pasajeros p ON p.id = le.pasajero_id
       JOIN vuelos    v ON v.id = le.vuelo_id
      WHERE le.id = $1`,
      [inserted.id],
    );

    const row = rows.rows[0];
    if (!row) throw new Error("encolarEnEspera: could not retrieve inserted row");
    return row;
  });
}
