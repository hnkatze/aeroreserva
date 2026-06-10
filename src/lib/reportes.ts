/**
 * reportes.ts — Capa de acceso a datos para el panel de reportes.
 *
 * Todas las consultas leen desde las vistas creadas en 009_reportes.sql
 * y 011_reportes_extra.sql:
 *   v_ocupacion_vuelo     — métricas de ocupación por vuelo
 *   v_ocupacion_aerolinea — métricas agregadas por aerolínea
 *   v_resumen_kpis        — indicadores globales (fila única)
 *   v_vuelos_por_estado   — distribución de vuelos por estado operativo
 *   v_ocupacion_ruta      — ocupación media por par origen→destino
 *   v_retraso_aerolinea   — puntualidad por aerolínea
 *   v_top_aeropuertos     — tráfico total (salidas + llegadas) por aeropuerto
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
// Interfaces para las vistas de migration 011
// ---------------------------------------------------------------------------

/** Fila de v_vuelos_por_estado. */
export interface VuelosPorEstado {
  estado: string;
  cantidad_vuelos: number;
  pct_total: number;
}

/** Fila de v_ocupacion_ruta. */
export interface OcupacionRuta {
  origen: string;
  destino: string;
  cantidad_vuelos: number;
  total_asientos: number;
  asientos_ocupados: number;
  pct_ocupacion_prom: number;
}

/** Fila de v_retraso_aerolinea. */
export interface RetrasoPorAerolinea {
  aerolinea_codigo: string;
  aerolinea_nombre: string | null;
  total_vuelos: number;
  vuelos_retrasados: number;
  pct_retrasados: number;
  /** Promedio de retraso_min sobre TODOS los vuelos (no retrasados = 0). */
  retraso_min_prom: number;
  /**
   * Promedio de retraso_min solo sobre vuelos efectivamente retrasados.
   * Es null si la aerolínea no tiene ningún vuelo retrasado.
   */
  retraso_min_prom_retrasados: number | null;
}

/** Fila de v_top_aeropuertos. */
export interface TopAeropuerto {
  codigo: string;
  nombre: string;
  ciudad: string;
  pais: string;
  vuelos_salientes: number;
  vuelos_entrantes: number;
  trafico_total: number;
}

// ---------------------------------------------------------------------------
// Tipos raw para migration 011 (pg devuelve bigint/numeric como string)
// ---------------------------------------------------------------------------

interface VuelosPorEstadoRaw {
  estado: string;
  cantidad_vuelos: string;
  pct_total: string | null;
}

interface OcupacionRutaRaw {
  origen: string;
  destino: string;
  cantidad_vuelos: string;
  total_asientos: string;
  asientos_ocupados: string;
  pct_ocupacion_prom: string | null;
}

interface RetrasoPorAerolineaRaw {
  aerolinea_codigo: string;
  aerolinea_nombre: string | null;
  total_vuelos: string;
  vuelos_retrasados: string;
  pct_retrasados: string | null;
  retraso_min_prom: string | null;
  retraso_min_prom_retrasados: string | null;
}

interface TopAeropuertoRaw {
  codigo: string;
  nombre: string;
  ciudad: string;
  pais: string;
  vuelos_salientes: string;
  vuelos_entrantes: string;
  trafico_total: string;
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

export interface OcupacionPorRutaOptions {
  /**
   * Número máximo de rutas a devolver, ordenadas por % de ocupación
   * descendente. Por defecto 20. La vista tiene ~370 rutas distintas.
   */
  limit?: number;
}

export interface TopAeropuertosOptions {
  /**
   * Número máximo de aeropuertos a devolver, ordenados por tráfico total
   * descendente. Por defecto 10.
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

// ---------------------------------------------------------------------------
// Funciones nuevas — migration 011
// ---------------------------------------------------------------------------

/**
 * Devuelve la distribución de vuelos por estado operativo.
 * Todos los estados posibles (programado, retrasado, cancelado, etc.)
 * con su cantidad y porcentaje sobre el total de vuelos.
 * La vista usa idx_vuelos_estado → consulta muy rápida (< 5 ms).
 */
export async function vuelosPorEstado(): Promise<VuelosPorEstado[]> {
  const rows = await query<VuelosPorEstadoRaw>(
    `SELECT estado, cantidad_vuelos, pct_total
     FROM v_vuelos_por_estado`,
  );

  return rows.map((r) => ({
    estado: r.estado,
    cantidad_vuelos: Number(r.cantidad_vuelos),
    pct_total: Number(r.pct_total ?? 0),
  }));
}

/**
 * Devuelve las N rutas (par origen→destino) con mayor ocupación promedio.
 * Ordenadas por pct_ocupacion_prom DESC, cantidad_vuelos DESC.
 * Por defecto trae 20; la vista completa tiene ~370 rutas distintas.
 *
 * Performance: agrega sobre v_ocupacion_vuelo (~6.667 filas), no sobre
 * asientos (1M). El scan pesado ya fue absorbido por v_ocupacion_vuelo.
 */
export async function ocupacionPorRuta(
  opts: OcupacionPorRutaOptions = {},
): Promise<OcupacionRuta[]> {
  const limit = opts.limit ?? 20;

  const rows = await query<OcupacionRutaRaw>(
    `SELECT origen, destino, cantidad_vuelos, total_asientos,
            asientos_ocupados, pct_ocupacion_prom
     FROM v_ocupacion_ruta
     LIMIT $1`,
    [limit],
  );

  return rows.map((r) => ({
    origen: r.origen,
    destino: r.destino,
    cantidad_vuelos: Number(r.cantidad_vuelos),
    total_asientos: Number(r.total_asientos),
    asientos_ocupados: Number(r.asientos_ocupados),
    pct_ocupacion_prom: Number(r.pct_ocupacion_prom ?? 0),
  }));
}

/**
 * Devuelve las métricas de puntualidad de todas las aerolíneas,
 * ordenadas por porcentaje de vuelos retrasados descendente.
 * Son pocas aerolíneas (~5) → sin paginación.
 *
 * Semántica de retraso_min_prom vs retraso_min_prom_retrasados:
 *   - retraso_min_prom: promedio sobre TODOS los vuelos (no retrasados = 0).
 *     Refleja el impacto real en la operación total.
 *   - retraso_min_prom_retrasados: promedio solo entre los retrasados.
 *     Útil para comparar la "gravedad" entre aerolíneas.
 */
export async function retrasoPorAerolinea(): Promise<RetrasoPorAerolinea[]> {
  const rows = await query<RetrasoPorAerolineaRaw>(
    `SELECT aerolinea_codigo, aerolinea_nombre, total_vuelos,
            vuelos_retrasados, pct_retrasados,
            retraso_min_prom, retraso_min_prom_retrasados
     FROM v_retraso_aerolinea`,
  );

  return rows.map((r) => ({
    aerolinea_codigo: r.aerolinea_codigo,
    aerolinea_nombre: r.aerolinea_nombre,
    total_vuelos: Number(r.total_vuelos),
    vuelos_retrasados: Number(r.vuelos_retrasados),
    pct_retrasados: Number(r.pct_retrasados ?? 0),
    retraso_min_prom: Number(r.retraso_min_prom ?? 0),
    retraso_min_prom_retrasados:
      r.retraso_min_prom_retrasados !== null
        ? Number(r.retraso_min_prom_retrasados)
        : null,
  }));
}

/**
 * Devuelve los N aeropuertos con mayor tráfico total (salidas + llegadas).
 * Ordenados por trafico_total DESC.
 * Por defecto trae 10; la vista completa tiene todos los aeropuertos activos.
 *
 * Performance: el JOIN y FULL OUTER se resuelven en O(2 × 6.667) sobre
 * vuelos + Hash Join con aeropuertos (~100-300 filas). Rápido incluso sin
 * caché (< 20 ms).
 */
export async function topAeropuertos(
  opts: TopAeropuertosOptions = {},
): Promise<TopAeropuerto[]> {
  const limit = opts.limit ?? 10;

  const rows = await query<TopAeropuertoRaw>(
    `SELECT codigo, nombre, ciudad, pais,
            vuelos_salientes, vuelos_entrantes, trafico_total
     FROM v_top_aeropuertos
     LIMIT $1`,
    [limit],
  );

  return rows.map((r) => ({
    codigo: r.codigo,
    nombre: r.nombre,
    ciudad: r.ciudad,
    pais: r.pais,
    vuelos_salientes: Number(r.vuelos_salientes),
    vuelos_entrantes: Number(r.vuelos_entrantes),
    trafico_total: Number(r.trafico_total),
  }));
}
