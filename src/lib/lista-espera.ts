import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/db";
import { upsertPasajero } from "@/lib/pasajeros";
import type { PgRole } from "@/lib/auth";

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
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  if (opts.incluirPromovidas) {
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
      WHERE le.estado IN ('esperando', 'promovida')
      ORDER BY v.codigo, le.posicion, le.id
      LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
  }

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
    WHERE le.estado = 'esperando'
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
  const rows = await query<{ total: string }>(
    opts.incluirPromovidas
      ? `SELECT COUNT(*) AS total FROM lista_espera WHERE estado IN ('esperando', 'promovida')`
      : `SELECT COUNT(*) AS total FROM lista_espera WHERE estado = 'esperando'`,
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
  /** PostgreSQL NOLOGIN role to activate for this transaction (from migration 006). */
  pgRole?: PgRole;
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

    // Step 2 + 3: enqueue via the SECURITY DEFINER function encolar_espera()
    // defined in migration 008_lista_espera.sql.
    //
    // Why use the function instead of a direct INSERT?
    // Migration 006 grants app_agente only SELECT on lista_espera (not INSERT).
    // The SECURITY DEFINER function runs as its owner (postgres) regardless of
    // the calling role, so app_agente can enqueue without needing INSERT on
    // the table directly.  app_admin has ALL privileges so it works either way.
    //
    // The function also enforces the same COALESCE(MAX(posicion),0)+1 logic and
    // the ux_lista_espera_vuelo_pasajero PARTIAL unique index (migration 014,
    // WHERE estado='esperando'), so callers still receive 23505 when the
    // passenger is already actively waiting for this flight.
    const fnResult = await client.query<{ encolar_espera: number }>(
      `SELECT encolar_espera($1, $2) AS encolar_espera`,
      [input.vueloId, pasajeroId],
    );

    const insertedId = fnResult.rows[0]?.encolar_espera;
    if (insertedId === undefined || insertedId === null) {
      throw new Error("encolarEnEspera: encolar_espera() returned no id");
    }

    // Step 4: return the full denormalised row for the UI
    // app_agente has SELECT on lista_espera so this read works under that role.
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
      [insertedId],
    );

    const row = rows.rows[0];
    if (!row) throw new Error("encolarEnEspera: could not retrieve inserted row");
    return row;
  }, { pgRole: input.pgRole });
}

// ---------------------------------------------------------------------------
// promoverManual — operator-driven promotion (D8)
// ---------------------------------------------------------------------------

/**
 * Manually promote a waiting passenger by assigning them the FIRST free seat
 * on their flight (delegates to the promover_manual() SECURITY DEFINER
 * function from migration 013).
 *
 * The operator is published to app.current_operator inside the transaction so
 * the resulting reservation — and its audit trigger — record who promoted.
 *
 * @returns the new reserva id, or null when the flight has no free seat
 *   (the caller should surface "vuelo lleno, no se puede promover").
 */
export async function promoverManual(
  entradaId: number,
  operadorId: number,
  pgRole?: PgRole,
): Promise<number | null> {
  return withTransaction(async (client: PoolClient) => {
    await client.query(
      "SELECT set_config('app.current_operator', $1, true)",
      [String(operadorId)],
    );

    const result = await client.query<{ promover_manual: number | null }>(
      `SELECT promover_manual($1) AS promover_manual`,
      [entradaId],
    );

    return result.rows[0]?.promover_manual ?? null;
  }, { pgRole });
}

// ---------------------------------------------------------------------------
// cancelarEspera — withdraw a passenger from the queue
// ---------------------------------------------------------------------------

/**
 * Cancel a waitlist entry and close the gap so everyone behind moves up one
 * position (delegates to the cancelar_espera() SECURITY DEFINER function from
 * migration 013).
 *
 * @returns true when an 'esperando' entry was cancelled, false when the entry
 *   does not exist or is no longer waiting.
 */
export async function cancelarEspera(
  entradaId: number,
  pgRole?: PgRole,
): Promise<boolean> {
  return withTransaction(async (client: PoolClient) => {
    const result = await client.query<{ cancelar_espera: boolean }>(
      `SELECT cancelar_espera($1) AS cancelar_espera`,
      [entradaId],
    );

    return result.rows[0]?.cancelar_espera ?? false;
  }, { pgRole });
}
