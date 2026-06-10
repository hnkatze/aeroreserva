/**
 * dashboard.ts — Queries exclusivas del home del dashboard.
 *
 * Intencionalmente independientes de lib/reportes.ts para no acoplar
 * al agente de reportes. Las queries son simples y enfocadas en lo que
 * el home necesita.
 *
 * DECISIÓN DE DISEÑO — "Ocupación promedio":
 *   v_resumen_kpis.pct_ocupacion_global calcula el % sobre ~1.000.050 asientos.
 *   Con pocos asientos ocupados el número resulta ~0%, que es correcto pero
 *   confuso en el dashboard operativo.
 *   En su lugar calculamos el promedio aritmético de pct_ocupacion SOLO sobre
 *   los vuelos que tienen al menos un asiento ocupado. Así el KPI refleja
 *   "¿cómo se están llenando los vuelos que efectivamente tienen pasajeros?"
 *   y el número es significativo desde el primer registro.
 */

import { query } from "@/lib/db";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** KPIs para las 4 tarjetas del home. */
export interface DashboardKpis {
  /** Reservas con estado = 'confirmada'. */
  reservasActivas: number;
  /**
   * Promedio de % de ocupación sobre vuelos con al menos un asiento ocupado.
   * NULL si no hay ningún vuelo con pasajeros (catálogo vacío o sin reservas).
   */
  ocupacionPromedio: number | null;
  /** Vuelos con estado = 'retrasado'. */
  vuelosRetrasados: number;
  /** Entradas en lista de espera con estado = 'esperando'. */
  enListaEspera: number;
}

/** Fila de la tabla "Próximos vuelos" del home. */
export interface VueloProximo {
  id: number;
  codigo: string;
  origen: string;
  destino: string;
  /** Timestamp de salida (viene como Date desde pg). */
  salida: Date;
  estado: string;
  retraso_min: number;
  /** Asientos marcados como 'ocupado'. */
  asientos_ocupados: number;
  /** Capacidad total del vuelo (puede ser 0 si no tiene asientos cargados). */
  asientos_total: number;
  /** Porcentaje de ocupación redondeado, o null si total = 0. */
  pct_ocupacion: number | null;
}

// ---------------------------------------------------------------------------
// Tipos raw (pg devuelve bigint/numeric como string)
// ---------------------------------------------------------------------------

interface DashboardKpisRaw {
  reservas_activas: string;
  ocupacion_promedio: string | null;
  vuelos_retrasados: string;
  en_lista_espera: string;
}

interface VueloProximoRaw {
  id: number;
  codigo: string;
  origen: string;
  destino: string;
  salida: Date;
  estado: string;
  retraso_min: number;
  asientos_ocupados: string;
  asientos_total: string;
  pct_ocupacion: string | null;
}

// ---------------------------------------------------------------------------
// kpisDashboard
// ---------------------------------------------------------------------------

/**
 * Devuelve los 4 KPIs del home en una sola round-trip.
 *
 * La ocupación promedio usa AVG de pct_ocupacion de v_ocupacion_vuelo
 * filtrada a vuelos con ocupados > 0.  Esto evita que la media sea arrastrada
 * por los miles de vuelos vacíos del catálogo de muestra.
 */
export async function kpisDashboard(): Promise<DashboardKpis> {
  const rows = await query<DashboardKpisRaw>(
    `SELECT
       -- 1. Reservas activas: reservas de negocio confirmadas
       (SELECT count(*)::bigint FROM reservas WHERE estado = 'confirmada')
         AS reservas_activas,

       -- 2. Ocupación promedio: AVG de pct_ocupacion solo sobre vuelos con
       --    al menos un asiento ocupado.  El filtro WHERE ocupados > 0 excluye
       --    los vuelos vacíos del catálogo demo, evitando un resultado de ~0%.
       (SELECT ROUND(AVG(pct_ocupacion))
          FROM v_ocupacion_vuelo
         WHERE ocupados > 0)
         AS ocupacion_promedio,

       -- 3. Vuelos retrasados: estado operativo
       (SELECT count(*)::bigint FROM vuelos WHERE estado = 'retrasado')
         AS vuelos_retrasados,

       -- 4. En lista de espera: entradas activas pendientes de promoción
       (SELECT count(*)::bigint FROM lista_espera WHERE estado = 'esperando')
         AS en_lista_espera`,
  );

  const row = rows[0];
  // La query siempre devuelve exactamente una fila (es un SELECT de subqueries
  // escalares sin FROM).  El guard es defensivo.
  if (!row) throw new Error("kpisDashboard: query returned no rows");

  return {
    reservasActivas: Number(row.reservas_activas),
    ocupacionPromedio:
      row.ocupacion_promedio !== null ? Number(row.ocupacion_promedio) : null,
    vuelosRetrasados: Number(row.vuelos_retrasados),
    enListaEspera: Number(row.en_lista_espera),
  };
}

// ---------------------------------------------------------------------------
// proximosVuelos
// ---------------------------------------------------------------------------

export interface ProximosVuelosOptions {
  /** Máximo de vuelos a devolver. Por defecto 8. */
  limit?: number;
}

/**
 * Devuelve los próximos vuelos ordenados por salida ASC.
 * Incluye métricas de ocupación calculadas en la misma query via subquery
 * lateral, evitando N+1 y sin depender de lib/reportes.ts.
 */
export async function proximosVuelos(
  opts: ProximosVuelosOptions = {},
): Promise<VueloProximo[]> {
  const limit = opts.limit ?? 8;

  const rows = await query<VueloProximoRaw>(
    `SELECT
       v.id,
       v.codigo,
       v.origen,
       v.destino,
       v.salida,
       v.estado,
       v.retraso_min,
       -- Contamos asientos directamente con COUNT + FILTER en una subquery
       -- correlacionada para no depender de la vista v_ocupacion_vuelo.
       -- Esto permite que la query sea completamente autónoma.
       COALESCE(ocp.ocupados, 0)                         AS asientos_ocupados,
       COALESCE(ocp.total, 0)                            AS asientos_total,
       ocp.pct_ocupacion                                  AS pct_ocupacion
     FROM vuelos v
     LEFT JOIN LATERAL (
       SELECT
         COUNT(s.id)                                            AS total,
         COUNT(s.id) FILTER (WHERE s.estado = 'ocupado')       AS ocupados,
         ROUND(
           COUNT(s.id) FILTER (WHERE s.estado = 'ocupado')
           * 100.0
           / NULLIF(COUNT(s.id), 0)
         )                                                      AS pct_ocupacion
       FROM asientos s
       WHERE s.vuelo_id = v.id
     ) ocp ON true
     ORDER BY v.salida ASC
     LIMIT $1`,
    [limit],
  );

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    origen: r.origen,
    destino: r.destino,
    salida: r.salida,
    estado: r.estado,
    retraso_min: r.retraso_min,
    asientos_ocupados: Number(r.asientos_ocupados),
    asientos_total: Number(r.asientos_total),
    pct_ocupacion:
      r.pct_ocupacion !== null ? Number(r.pct_ocupacion) : null,
  }));
}
