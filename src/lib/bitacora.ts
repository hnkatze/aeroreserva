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

/**
 * Filters applied to the audit log. Every value is optional; an absent value
 * means "no constraint on that column". All values are bound as parameters —
 * never interpolated — so they are not an injection vector.
 */
export interface BitacoraFiltros {
  operacion?: "INSERT" | "UPDATE" | "DELETE";
  tabla?: string;
  /** PostgreSQL role that fired the statement (usuario_bd). */
  usuarioBd?: string;
  /** Inclusive lower bound on creado_en (ISO timestamp). */
  desde?: string;
  /** Inclusive upper bound on creado_en (ISO timestamp). */
  hasta?: string;
}

export interface ListarBitacoraOpts extends BitacoraFiltros {
  /** Maximum number of records to return. Defaults to 25. */
  limit?: number;
  /** Number of records to skip. Defaults to 0. */
  offset?: number;
}

/**
 * Build a parametrised WHERE clause from the filters. Column names are fixed
 * literals chosen in code; only the *values* come from the caller and they are
 * bound as $1, $2, … — so this is safe against SQL injection.
 */
function construirWhere(f: BitacoraFiltros): {
  clause: string;
  params: unknown[];
} {
  const conds: string[] = [];
  const params: unknown[] = [];

  if (f.operacion) {
    params.push(f.operacion);
    conds.push(`operacion = $${params.length}`);
  }
  if (f.tabla) {
    params.push(f.tabla);
    conds.push(`tabla = $${params.length}`);
  }
  if (f.usuarioBd) {
    params.push(f.usuarioBd);
    conds.push(`usuario_bd = $${params.length}`);
  }
  if (f.desde) {
    params.push(f.desde);
    conds.push(`creado_en >= $${params.length}`);
  }
  if (f.hasta) {
    params.push(f.hasta);
    conds.push(`creado_en <= $${params.length}`);
  }

  return {
    clause: conds.length ? `WHERE ${conds.join(" AND ")}` : "",
    params,
  };
}

// ---------------------------------------------------------------------------
// listarBitacora
// ---------------------------------------------------------------------------

/**
 * Return a paginated, optionally filtered list of audit log entries, newest
 * first. JSONB columns (datos_anteriores, datos_nuevos) are returned as plain
 * objects by the pg driver — typed as Record<string, unknown> to avoid
 * any / unknown leakage into callers.
 * Defaults: limit = 25, offset = 0.
 */
export async function listarBitacora(
  opts: ListarBitacoraOpts = {},
): Promise<RegistroBitacora[]> {
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  const { clause, params } = construirWhere(opts);

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
     ${clause}
     ORDER BY creado_en DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return rows;
}

// ---------------------------------------------------------------------------
// obtenerAuditoriaDeRegistro
// ---------------------------------------------------------------------------

/**
 * Return all audit log entries for a specific table row, ordered oldest→newest
 * so the trail reads: creation → mutations → (optional) deletion.
 */
export async function obtenerAuditoriaDeRegistro(
  tabla: string,
  registroId: string,
): Promise<RegistroBitacora[]> {
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
     WHERE tabla = $1 AND registro_id = $2
     ORDER BY creado_en ASC`,
    [tabla, registroId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// contarBitacora
// ---------------------------------------------------------------------------

/**
 * Return the total count of audit log entries matching the given filters.
 * Used for pagination metadata — must apply the SAME filters as listarBitacora
 * so the page count reflects the filtered result set.
 */
export async function contarBitacora(
  filtros: BitacoraFiltros = {},
): Promise<number> {
  const { clause, params } = construirWhere(filtros);
  const rows = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM bitacora ${clause}`,
    params,
  );
  return Number(rows[0]?.total ?? 0);
}

// ---------------------------------------------------------------------------
// obtenerOpcionesFiltro
// ---------------------------------------------------------------------------

export interface OpcionesFiltroBitacora {
  /** Distinct table names present in the audit log (real, not hardcoded). */
  tablas: string[];
  /** Distinct PostgreSQL roles that produced audit entries. */
  usuarios: string[];
}

/**
 * Return the distinct values actually present in the audit log so the filter
 * dropdowns offer real options instead of a hardcoded mock list.
 */
export async function obtenerOpcionesFiltro(): Promise<OpcionesFiltroBitacora> {
  const [tablas, usuarios] = await Promise.all([
    query<{ tabla: string }>(
      `SELECT DISTINCT tabla FROM bitacora ORDER BY tabla`,
    ),
    query<{ usuario_bd: string }>(
      `SELECT DISTINCT usuario_bd FROM bitacora ORDER BY usuario_bd`,
    ),
  ]);
  return {
    tablas: tablas.map((r) => r.tabla),
    usuarios: usuarios.map((r) => r.usuario_bd),
  };
}
