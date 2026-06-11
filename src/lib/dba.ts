import { query } from "@/lib/db"

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TamanoTabla {
  tabla: string
  filas_estimadas: number
  tamano_datos: string
  tamano_indices: string
  tamano_total: string
  /** Raw bytes — used for sorting in the UI */
  bytes_total: number
}

export interface IndiceTabla {
  tabla: string
  nombre_indice: string
  definicion: string
}

export interface EstadisticasUso {
  tabla: string
  seq_scan: number
  idx_scan: number
  ins: number
  upd: number
  del: number
  tuplas_vivas: number
  tuplas_muertas: number
}

export interface ResumenBase {
  nombre_bd: string
  tamano_bd: string
  version_pg: string
  conexiones_activas: number
  total_tablas: number
}

// ---------------------------------------------------------------------------
// Query helpers — all read-only SELECT against system catalogs
// ---------------------------------------------------------------------------

/**
 * Per-table size breakdown from pg_catalog.
 * Uses pg_total_relation_size, pg_relation_size, pg_indexes_size and
 * pg_stat_user_tables.n_live_tup for row estimate.
 * Results ordered by total size descending.
 */
export async function obtenerTamanosTablas(): Promise<TamanoTabla[]> {
  type Row = {
    tabla: string
    filas_estimadas: string
    tamano_datos: string
    tamano_indices: string
    tamano_total: string
    bytes_total: string
  }

  const rows = await query<Row>(`
    SELECT
      c.relname::text                                          AS tabla,
      COALESCE(s.n_live_tup, 0)::text                         AS filas_estimadas,
      pg_size_pretty(pg_relation_size(c.oid))                 AS tamano_datos,
      pg_size_pretty(pg_indexes_size(c.oid))                  AS tamano_indices,
      pg_size_pretty(pg_total_relation_size(c.oid))           AS tamano_total,
      pg_total_relation_size(c.oid)::text                     AS bytes_total
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
  `)

  return rows.map((r) => ({
    tabla: r.tabla,
    filas_estimadas: parseInt(r.filas_estimadas, 10),
    tamano_datos: r.tamano_datos,
    tamano_indices: r.tamano_indices,
    tamano_total: r.tamano_total,
    bytes_total: parseInt(r.bytes_total, 10),
  }))
}

/**
 * All indexes in the public schema from pg_indexes.
 * The UI groups these by table name.
 */
export async function obtenerIndices(): Promise<IndiceTabla[]> {
  type Row = {
    tabla: string
    nombre_indice: string
    definicion: string
  }

  const rows = await query<Row>(`
    SELECT
      tablename::text  AS tabla,
      indexname::text  AS nombre_indice,
      indexdef::text   AS definicion
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `)

  return rows.map((r) => ({
    tabla: r.tabla,
    nombre_indice: r.nombre_indice,
    definicion: r.definicion,
  }))
}

/**
 * Per-table read/write patterns from pg_stat_user_tables.
 * High seq_scan vs idx_scan → possible missing index.
 * High n_dead_tup → candidate for VACUUM.
 */
export async function obtenerEstadisticasUso(): Promise<EstadisticasUso[]> {
  type Row = {
    tabla: string
    seq_scan: string
    idx_scan: string
    ins: string
    upd: string
    del: string
    tuplas_vivas: string
    tuplas_muertas: string
  }

  const rows = await query<Row>(`
    SELECT
      relname::text                     AS tabla,
      COALESCE(seq_scan, 0)::text       AS seq_scan,
      COALESCE(idx_scan, 0)::text       AS idx_scan,
      COALESCE(n_tup_ins, 0)::text      AS ins,
      COALESCE(n_tup_upd, 0)::text      AS upd,
      COALESCE(n_tup_del, 0)::text      AS del,
      COALESCE(n_live_tup, 0)::text     AS tuplas_vivas,
      COALESCE(n_dead_tup, 0)::text     AS tuplas_muertas
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY (COALESCE(seq_scan, 0) + COALESCE(idx_scan, 0)) DESC
  `)

  return rows.map((r) => ({
    tabla: r.tabla,
    seq_scan: parseInt(r.seq_scan, 10),
    idx_scan: parseInt(r.idx_scan, 10),
    ins: parseInt(r.ins, 10),
    upd: parseInt(r.upd, 10),
    del: parseInt(r.del, 10),
    tuplas_vivas: parseInt(r.tuplas_vivas, 10),
    tuplas_muertas: parseInt(r.tuplas_muertas, 10),
  }))
}

/**
 * High-level database summary: name, total size, Postgres version,
 * active connection count, and table count.
 */
export async function obtenerResumenBase(): Promise<ResumenBase> {
  type ResumenRow = {
    nombre_bd: string
    tamano_bd: string
    version_pg: string
    conexiones_activas: string
    total_tablas: string
  }

  const [row] = await query<ResumenRow>(`
    SELECT
      current_database()::text                                              AS nombre_bd,
      pg_size_pretty(pg_database_size(current_database()))                 AS tamano_bd,
      (SELECT version())::text                                              AS version_pg,
      (SELECT count(*)::text FROM pg_stat_activity
       WHERE datname = current_database())                                  AS conexiones_activas,
      (SELECT count(*)::text
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r')                     AS total_tablas
  `)

  if (!row) throw new Error("obtenerResumenBase: catalog query returned no rows")

  // Extract short version string: "PostgreSQL 17.2" from the long version()
  const versionMatch = /PostgreSQL\s+[\d.]+/i.exec(row.version_pg)
  const version_pg = versionMatch ? versionMatch[0] : row.version_pg

  return {
    nombre_bd: row.nombre_bd,
    tamano_bd: row.tamano_bd,
    version_pg,
    conexiones_activas: parseInt(row.conexiones_activas, 10),
    total_tablas: parseInt(row.total_tablas, 10),
  }
}
