import { query, withTransaction } from "@/lib/db";
import { upsertPasajero } from "@/lib/pasajeros";

// ---------------------------------------------------------------------------
// Domain error types
// ---------------------------------------------------------------------------

export class AsientoOcupadoError extends Error {
  constructor() {
    super("El asiento ya tiene una reserva confirmada");
    this.name = "AsientoOcupadoError";
  }
}

export class VueloNoEncontradoError extends Error {
  constructor(vueloId: number) {
    super(`El vuelo con id ${vueloId} no existe`);
    this.name = "VueloNoEncontradoError";
  }
}

export class AsientoNoEncontradoError extends Error {
  constructor(asientoId: number) {
    super(`El asiento con id ${asientoId} no existe o no pertenece al vuelo indicado`);
    this.name = "AsientoNoEncontradoError";
  }
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface CrearReservaInput {
  vueloId: number;
  asientoId: number;
  pasajero: { documento: string; nombre: string };
  operadorId: number;
}

export interface ReservaCompleta {
  id: number;
  estado: string;
  fecha: Date;
  pasajero_nombre: string;
  pasajero_documento: string;
  vuelo_codigo: string;
  asiento_numero: string;
  asiento_clase: string;
}

// ---------------------------------------------------------------------------
// Internal helper to detect pg error codes
// ---------------------------------------------------------------------------

function isPgError(
  error: unknown,
): error is { code: string; constraint?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

// ---------------------------------------------------------------------------
// crearReserva — full atomic transaction (design order: D1-D4)
// ---------------------------------------------------------------------------

/**
 * Create a reservation atomically:
 * 1. Upsert the passenger by document (within the tx).
 * 2. Lock the seat row with SELECT FOR UPDATE before validating.
 * 3. Validate the seat exists for the given flight.
 * 4. INSERT into reservas — catch 23505 on ux_reservas_vuelo_asiento → AsientoOcupadoError.
 * 5. UPDATE asientos.estado = 'ocupado'.
 * 6. SELECT join → ReservaCompleta.
 */
export async function crearReserva(
  input: CrearReservaInput,
): Promise<ReservaCompleta> {
  return withTransaction(async (client) => {
    // Set the application operator in the session so the audit trigger can
    // capture who initiated this reservation.  set_config with is_local=true
    // scopes the variable to this transaction only (equivalent to SET LOCAL),
    // which is the safe form when using parameterized queries.
    await client.query(
      "SELECT set_config('app.current_operator', $1, true)",
      [String(input.operadorId)],
    );

    // Step 1: upsert passenger inside the transaction (D3)
    const { id: pasajeroId } = await upsertPasajero(client, input.pasajero);

    // Step 2: lock the seat row before checking state (D2 — prevents TOCTOU)
    const lockResult = await client.query<{ id: number }>(
      `SELECT id FROM asientos WHERE id = $1 AND vuelo_id = $2 FOR UPDATE`,
      [input.asientoId, input.vueloId],
    );

    if (lockResult.rows.length === 0) {
      // Distinguish between "flight not found" vs "seat not found / wrong flight"
      const vueloResult = await client.query<{ id: number }>(
        `SELECT id FROM vuelos WHERE id = $1`,
        [input.vueloId],
      );
      if (vueloResult.rows.length === 0) {
        throw new VueloNoEncontradoError(input.vueloId);
      }
      throw new AsientoNoEncontradoError(input.asientoId);
    }

    // Step 3 (optional guard): explicit state check before the INSERT
    const stateResult = await client.query<{ estado: string }>(
      `SELECT estado FROM asientos WHERE id = $1`,
      [input.asientoId],
    );
    if (stateResult.rows[0]?.estado === "ocupado") {
      throw new AsientoOcupadoError();
    }

    // Step 4: insert reservation — pg 23505 on the partial index → AsientoOcupadoError
    let reservaId: number;
    try {
      const insertResult = await client.query<{ id: number }>(
        `INSERT INTO reservas (vuelo_id, asiento_id, pasajero_id, operador_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [input.vueloId, input.asientoId, pasajeroId, input.operadorId],
      );
      const inserted = insertResult.rows[0];
      if (!inserted) throw new Error("INSERT reserva returned no row");
      reservaId = inserted.id;
    } catch (error: unknown) {
      if (
        isPgError(error) &&
        error.code === "23505" &&
        error.constraint === "ux_reservas_vuelo_asiento"
      ) {
        throw new AsientoOcupadoError();
      }
      throw error;
    }

    // Step 5: mark seat as occupied (D4)
    await client.query(
      `UPDATE asientos SET estado = 'ocupado' WHERE id = $1`,
      [input.asientoId],
    );

    // Step 6: return the full reservation record via join
    const rows = await client.query<ReservaCompleta>(
      `SELECT
         r.id,
         r.estado,
         r.creado_en              AS fecha,
         p.nombre                 AS pasajero_nombre,
         p.documento              AS pasajero_documento,
         v.codigo                 AS vuelo_codigo,
         a.numero                 AS asiento_numero,
         a.clase                  AS asiento_clase
       FROM reservas r
       JOIN pasajeros  p ON p.id = r.pasajero_id
       JOIN vuelos     v ON v.id = r.vuelo_id
       JOIN asientos   a ON a.id = r.asiento_id
      WHERE r.id = $1`,
      [reservaId],
    );

    const row = rows.rows[0];
    if (!row) throw new Error("Could not retrieve created reservation");
    return row;
  });
}

// ---------------------------------------------------------------------------
// listarReservas
// ---------------------------------------------------------------------------

export interface ListarReservasOpts {
  /** Maximum number of records to return. Defaults to 25. */
  limit?: number;
  /** Number of records to skip. Defaults to 0. */
  offset?: number;
}

/**
 * Return a paginated list of reservations with their associated passenger,
 * flight and seat data, ordered by creation date descending.
 * Defaults: limit = 25, offset = 0.
 */
export async function listarReservas(
  opts: ListarReservasOpts = {},
): Promise<ReservaCompleta[]> {
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  return query<ReservaCompleta>(
    `SELECT
       r.id,
       r.estado,
       r.creado_en              AS fecha,
       p.nombre                 AS pasajero_nombre,
       p.documento              AS pasajero_documento,
       v.codigo                 AS vuelo_codigo,
       a.numero                 AS asiento_numero,
       a.clase                  AS asiento_clase
     FROM reservas r
     JOIN pasajeros  p ON p.id = r.pasajero_id
     JOIN vuelos     v ON v.id = r.vuelo_id
     JOIN asientos   a ON a.id = r.asiento_id
    ORDER BY r.creado_en DESC
    LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
}

// ---------------------------------------------------------------------------
// contarReservas
// ---------------------------------------------------------------------------

/**
 * Return the total count of reservations (all states).
 * Used for pagination metadata.
 */
export async function contarReservas(): Promise<number> {
  const rows = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM reservas`,
  );
  return Number(rows[0]?.total ?? 0);
}

// ---------------------------------------------------------------------------
// cancelarReserva — soft-cancel (D1)
// ---------------------------------------------------------------------------

/**
 * Cancel a reservation and free the seat within the same transaction.
 * Returns the updated reservation, or null if it does not exist.
 */
export async function cancelarReserva(
  id: number,
): Promise<ReservaCompleta | null> {
  return withTransaction(async (client) => {
    // Fetch the reservation to get the asiento_id
    const fetchResult = await client.query<{ id: number; asiento_id: number }>(
      `SELECT id, asiento_id FROM reservas WHERE id = $1`,
      [id],
    );

    if (fetchResult.rows.length === 0) return null;

    const reserva = fetchResult.rows[0];
    if (!reserva) return null;

    // Soft-cancel the reservation
    await client.query(
      `UPDATE reservas SET estado = 'cancelada' WHERE id = $1`,
      [id],
    );

    // Release the seat (D4 + RN-5)
    await client.query(
      `UPDATE asientos SET estado = 'libre' WHERE id = $1`,
      [reserva.asiento_id],
    );

    // Return the updated record
    const rows = await client.query<ReservaCompleta>(
      `SELECT
         r.id,
         r.estado,
         r.creado_en              AS fecha,
         p.nombre                 AS pasajero_nombre,
         p.documento              AS pasajero_documento,
         v.codigo                 AS vuelo_codigo,
         a.numero                 AS asiento_numero,
         a.clase                  AS asiento_clase
       FROM reservas r
       JOIN pasajeros  p ON p.id = r.pasajero_id
       JOIN vuelos     v ON v.id = r.vuelo_id
       JOIN asientos   a ON a.id = r.asiento_id
      WHERE r.id = $1`,
      [id],
    );

    return rows.rows[0] ?? null;
  });
}
