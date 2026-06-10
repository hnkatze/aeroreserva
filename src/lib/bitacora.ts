import { query } from "@/lib/db";
import type { QueryResultRow } from "pg";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface RegistroBitacora {
  id: number;
  tabla: string;
  operacion: "INSERT" | "UPDATE" | "DELETE";
  registro_id: string | null;
  /** Full row snapshot before the change; null for INSERT. */
  datos_anteriores: Record<string, unknown> | null;
  /** Full row snapshot after the change; null for DELETE. */
  datos_nuevos: Record<string, unknown> | null;
  /** PostgreSQL role that fired the statement. */
  usuario_bd: string;
  /** Application operator id set via set_config; null when not provided. */
  operador_id: number | null;
  creado_en: Date;
}

// pg QueryResultRow compatibility shim
interface BitacoraRow extends QueryResultRow {
  id: number;
  tabla: string;
  operacion: "INSERT" | "UPDATE" | "DELETE";
  registro_id: string | null;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  usuario_bd: string;
  operador_id: number | null;
  creado_en: Date;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ListarBitacoraOpts {
  /** Maximum number of records to return. Defaults to 25. */
  limit?: number;
  /** Number of records to skip. Defaults to 0. */
  offset?: number;
}

// ---------------------------------------------------------------------------
// listarBitacora
// ---------------------------------------------------------------------------

/**
 * Return a paginated list of audit log entries, newest first.
 * JSONB columns (datos_anteriores, datos_nuevos) are returned as plain
 * objects by the pg driver — typed as Record<string, unknown> to avoid
 * any / unknown leakage into callers.
 * Defaults: limit = 25, offset = 0.
 */
export async function listarBitacora(
  opts: ListarBitacoraOpts = {},
): Promise<RegistroBitacora[]> {
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  const rows = await query<BitacoraRow>(
    `SELECT
       id,
       tabla,
       operacion,
       registro_id,
       datos_anteriores,
       datos_nuevos,
       usuario_bd,
       operador_id,
       creado_en
     FROM bitacora
     ORDER BY creado_en DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  return rows;
}

// ---------------------------------------------------------------------------
// contarBitacora
// ---------------------------------------------------------------------------

/**
 * Return the total count of audit log entries.
 * Used for pagination metadata.
 */
export async function contarBitacora(): Promise<number> {
  const rows = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM bitacora`,
  );
  return Number(rows[0]?.total ?? 0);
}
