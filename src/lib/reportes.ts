/**
 * reportes.ts — Capa de acceso a datos para el panel de reportes.
 *
 * Todas las consultas leen desde las vistas creadas en 009_reportes.sql:
 *   v_ocupacion_vuelo    — métricas de ocupación por vuelo
 *   v_ocupacion_aerolinea — métricas agregadas por aerolínea
 *   v_resumen_kpis        — indicadores globales (fila única)
 *
 * Convenciones:
 *   - Sin `any`. Tipos explícitos alineados con las columnas de cada vista.
 *   - Números devueltos por pg como string → convertidos a number en los tipos.
 *   - Límite por defecto conservador (25) para `ocupacionPorVuelo` dado que
 *     la vista cubre 6667 vuelos; traer todos sería innecesario en la UI.
 */

import { query } from "@/lib/db";

// ---------------------------------------------------------------------------
// Interfaces — modelan exactamente las columnas de las vistas
// ---------------------------------------------------------------------------

/**
 * Fila de v_ocupacion_vuelo.
 * `total_asientos`, `ocupados`, `libres` y `pct_ocupacion` llegan como
 * string desde pg (tipo bigint/numeric) y se parsean en las funciones.
 */
export interface OcupacionVuelo {
  vuelo_id: number;
  codigo: string;
  origen: string;
  destino: string;
  aerolinea_codigo: string | null;
  aerolinea_nombre: string | null;
  total_asientos: number;
  ocupados: number;
  libres: number;
  pct_ocupacion: number;
}

/** Fila de v_ocupacion_aerolinea. */
export interface OcupacionAerolinea {
  aerolinea_codigo: string;
  aerolinea_nombre: string | null;
  cantidad_vuelos: number;
  total_asientos: number;
  total_ocupados: number;
  pct_ocupacion_prom: number;
}

/** Fila única de v_resumen_kpis. */
export interface ResumenKpis {
  total_vuelos: number;
  total_asientos: number;
  asientos_ocupados: number;
  asientos_libres: number;
  pct_ocupacion_global: number;
  reservas_confirmadas: number;
  vuelos_llenos: number;
  aerolineas_activas: number;
}

// ---------------------------------------------------------------------------
// Tipos raw de pg (las columnas numéricas llegan como string)
// ---------------------------------------------------------------------------

/** Fila cruda tal como la devuelve pg (antes de parsear). */
interface OcupacionVueloRaw {
  vuelo_id: number;
  codigo: string;
  origen: string;
  destino: string;
  aerolinea_codigo: string | null;
  aerolinea_nombre: string | null;
  total_asientos: string;
  ocupados: string;
  libres: string;
  pct_ocupacion: string | null;
}

interface OcupacionAerolineaRaw {
  aerolinea_codigo: string;
  aerolinea_nombre: string | null;
  cantidad_vuelos: string;
  total_asientos: string;
  total_ocupados: string;
  pct_ocupacion_prom: string | null;
}

interface ResumenKpisRaw {
  total_vuelos: number;
  total_asientos: number;
  asientos_ocupados: number;
  asientos_libres: number;
  pct_ocupacion_global: string | null;
  reservas_confirmadas: number;
  vuelos_llenos: number;
  aerolineas_activas: number;
}

// ---------------------------------------------------------------------------
// Opciones
// ---------------------------------------------------------------------------

export interface OcupacionPorVueloOptions {
  /**
   * Número máximo de vuelos a devolver, ordenados por % de ocupación
   * descendente. Por defecto 25. Para no traer los 6.667 vuelos de una vez.
   */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Funciones públicas
// ---------------------------------------------------------------------------

/**
 * Devuelve los N vuelos con mayor porcentaje de ocupación.
 * Ordenados por `pct_ocupacion DESC NULLS LAST` (vuelos sin asientos al final).
 * Por defecto trae 25; pasá `{ limit: 50 }` para más o `{ limit: 6667 }`
 * si necesitás el catálogo completo (no recomendado en UI).
 */
export async function ocupacionPorVuelo(
  opts: OcupacionPorVueloOptions = {},
): Promise<OcupacionVuelo[]> {
  const limit = opts.limit ?? 25;

  const rows = await query<OcupacionVueloRaw>(
    `SELECT
       vuelo_id,
       codigo,
       origen,
       destino,
       aerolinea_codigo,
       aerolinea_nombre,
       total_asientos,
       ocupados,
       libres,
       pct_ocupacion
     FROM v_ocupacion_vuelo
     ORDER BY pct_ocupacion DESC NULLS LAST, total_asientos DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map((r) => ({
    vuelo_id: Number(r.vuelo_id),
    codigo: r.codigo,
    origen: r.origen,
    destino: r.destino,
    aerolinea_codigo: r.aerolinea_codigo,
    aerolinea_nombre: r.aerolinea_nombre,
    total_asientos: Number(r.total_asientos),
    ocupados: Number(r.ocupados),
    libres: Number(r.libres),
    pct_ocupacion: Number(r.pct_ocupacion ?? 0),
  }));
}

/**
 * Devuelve todas las aerolíneas con sus métricas de ocupación agregadas,
 * ordenadas por % de ocupación promedio descendente.
 * Son solo 5 aerolíneas en el catálogo actual, por lo que no paginamos.
 */
export async function ocupacionPorAerolinea(): Promise<OcupacionAerolinea[]> {
  const rows = await query<OcupacionAerolineaRaw>(
    `SELECT
       aerolinea_codigo,
       aerolinea_nombre,
       cantidad_vuelos,
       total_asientos,
       total_ocupados,
       pct_ocupacion_prom
     FROM v_ocupacion_aerolinea
     ORDER BY pct_ocupacion_prom DESC NULLS LAST`,
  );

  return rows.map((r) => ({
    aerolinea_codigo: r.aerolinea_codigo,
    aerolinea_nombre: r.aerolinea_nombre,
    cantidad_vuelos: Number(r.cantidad_vuelos),
    total_asientos: Number(r.total_asientos),
    total_ocupados: Number(r.total_ocupados),
    pct_ocupacion_prom: Number(r.pct_ocupacion_prom ?? 0),
  }));
}

/**
 * Devuelve los KPIs globales del panel.
 * La vista v_resumen_kpis siempre devuelve exactamente una fila.
 * Lanza un Error si la vista está vacía (caso imposible en producción).
 */
export async function resumenKpis(): Promise<ResumenKpis> {
  const rows = await query<ResumenKpisRaw>(`SELECT * FROM v_resumen_kpis`);
  const row = rows[0];
  if (!row) throw new Error("v_resumen_kpis returned no rows");

  return {
    total_vuelos: Number(row.total_vuelos),
    total_asientos: Number(row.total_asientos),
    asientos_ocupados: Number(row.asientos_ocupados),
    asientos_libres: Number(row.asientos_libres),
    pct_ocupacion_global: Number(row.pct_ocupacion_global ?? 0),
    reservas_confirmadas: Number(row.reservas_confirmadas),
    vuelos_llenos: Number(row.vuelos_llenos),
    aerolineas_activas: Number(row.aerolineas_activas),
  };
}
