-- Migration 009: Vistas de reportes de ocupación
-- ====================================================================
-- Propósito (material didáctico): demostrar el uso de VIEWs como capa
-- de abstracción para reportes, desacoplando las consultas complejas de
-- la lógica de aplicación. Cada vista incluye comentarios sobre el plan
-- de ejecución y las decisiones de performance.
--
-- CONTEXTO DE DATOS:
--   vuelos     ~6.667 filas
--   asientos   ~1.000.050 filas  ← la tabla grande; agrupamos siempre
--   aerolineas ~5 filas
--   reservas   variable (soft-delete: estado IN ('confirmada','cancelada'))
--
-- ESTRATEGIA DE PERFORMANCE:
--   Las agregaciones sobre asientos (1M filas) se hacen con COUNT + FILTER
--   en un solo GROUP BY vuelo_id, evitando dos scans. PostgreSQL puede
--   usar el índice de vuelo_id en asientos si existe; de lo contrario usa
--   un Seq Scan + HashAggregate, que para 1M filas tarda ~300-500 ms la
--   primera vez pero se cachea en shared_buffers.
--
--   v_ocupacion_vuelo: agrupación sobre asientos JOIN vuelos → O(asientos)
--   v_ocupacion_aerolinea: dos niveles de agregación sobre la vista anterior
--   v_resumen_kpis: subqueries escalares, cada una es O(asientos) o O(reservas)
--
-- GRANT:
--   Al final se otorga SELECT sobre las tres vistas a los roles de la
--   migration 006 (app_consulta, app_agente, app_admin). Los roles deben
--   existir; si no, los GRANTs fallan con "role does not exist". Aplica
--   esta migración después de 006_roles.sql.
-- ====================================================================


-- --------------------------------------------------------------------
-- VISTA 1: v_ocupacion_vuelo
-- --------------------------------------------------------------------
-- Agrega el estado de los asientos por vuelo para obtener métricas de
-- ocupación. El JOIN con aerolineas y aeropuertos enriquece el resultado
-- con nombres legibles.
--
-- COLUMNAS:
--   vuelo_id          — PK del vuelo (útil para joins desde la app)
--   codigo            — código IATA del vuelo (ej. "ABJ0001")
--   origen            — código IATA del aeropuerto de origen
--   destino           — código IATA del aeropuerto de destino
--   aerolinea_codigo  — código de la aerolínea operadora
--   aerolinea_nombre  — nombre completo de la aerolínea
--   total_asientos    — capacidad total del vuelo
--   ocupados          — asientos con estado = 'ocupado'
--   libres            — asientos con estado = 'libre' (= total - ocupados)
--   pct_ocupacion     — porcentaje redondeado; 0 si total = 0 (guard vs /0)
--
-- PLAN ESPERADO (EXPLAIN ANALYZE):
--   HashAggregate sobre Seq Scan de asientos (1M filas)
--   → Hash Join con vuelos (6667 filas, hash cabe en memoria)
--   → Hash Join con aerolineas (5 filas, hash trivial)
--   Tiempo estimado primera ejecución: 300-600 ms (sin caché)
--   Con shared_buffers caliente: 50-150 ms
-- --------------------------------------------------------------------

CREATE OR REPLACE VIEW v_ocupacion_vuelo AS
SELECT
    v.id                                                    AS vuelo_id,
    v.codigo,
    v.origen,
    v.destino,
    v.aerolinea_codigo,
    a.nombre                                                AS aerolinea_nombre,
    -- Contamos con COUNT + FILTER: un solo recorrido de la tabla asientos
    -- por vuelo, más eficiente que dos subconsultas separadas.
    COUNT(s.id)                                             AS total_asientos,
    COUNT(s.id) FILTER (WHERE s.estado = 'ocupado')         AS ocupados,
    COUNT(s.id) FILTER (WHERE s.estado = 'libre')           AS libres,
    -- NULLIF evita división por cero si un vuelo no tuviera asientos cargados.
    ROUND(
        COUNT(s.id) FILTER (WHERE s.estado = 'ocupado')
        * 100.0
        / NULLIF(COUNT(s.id), 0)
    )                                                       AS pct_ocupacion
FROM vuelos v
LEFT JOIN aerolineas a  ON a.codigo = v.aerolinea_codigo
LEFT JOIN asientos   s  ON s.vuelo_id = v.id
-- LEFT JOIN: incluye vuelos sin asientos cargados (total=0, ocupados=0)
GROUP BY v.id, v.codigo, v.origen, v.destino, v.aerolinea_codigo, a.nombre;

-- Comentario didáctico sobre el índice:
-- La columna asientos.vuelo_id debería tener un índice para que el Hash Join
-- pueda usar Index Scan en lugar de Seq Scan. Si la migración 002 no lo creó,
-- el planner usará un Seq Scan sobre 1M filas. Para una tabla de BI de solo
-- lectura esto es aceptable; para OLTP agregarías:
--   CREATE INDEX IF NOT EXISTS idx_asientos_vuelo_id ON asientos(vuelo_id);


-- --------------------------------------------------------------------
-- VISTA 2: v_ocupacion_aerolinea
-- --------------------------------------------------------------------
-- Agrega los datos de v_ocupacion_vuelo al nivel de aerolínea.
-- Construir sobre la vista anterior (en lugar de re-agregar desde asientos)
-- hace el SQL más claro, aunque PostgreSQL iguala los planes en la práctica
-- porque optimiza a través de las vistas simples.
--
-- COLUMNAS:
--   aerolinea_codigo   — código IATA de la aerolínea
--   aerolinea_nombre   — nombre completo
--   cantidad_vuelos    — número de vuelos operados
--   total_asientos     — suma de capacidad en todos sus vuelos
--   total_ocupados     — suma de asientos ocupados
--   pct_ocupacion_prom — porcentaje de ocupación promedio ponderado
--                        (total_ocupados / total_asientos * 100),
--                        NO un promedio aritmético de porcentajes,
--                        que sería un promedio de promedios (incorrecto).
--
-- NOTA DIDÁCTICA: "promedio ponderado" vs "promedio aritmético de %"
--   Si una aerolínea tiene vuelo A (10/100 = 10%) y vuelo B (90/100 = 90%),
--   el promedio aritmético de % = 50%, pero el real es 100/200 = 50% en
--   este caso. Para vuelos de distinta capacidad la diferencia es grande.
--   Usamos el ponderado porque refleja la realidad operativa.
-- --------------------------------------------------------------------

CREATE OR REPLACE VIEW v_ocupacion_aerolinea AS
SELECT
    ov.aerolinea_codigo,
    ov.aerolinea_nombre,
    COUNT(*)                        AS cantidad_vuelos,
    SUM(ov.total_asientos)          AS total_asientos,
    SUM(ov.ocupados)                AS total_ocupados,
    ROUND(
        SUM(ov.ocupados) * 100.0
        / NULLIF(SUM(ov.total_asientos), 0)
    )                               AS pct_ocupacion_prom
FROM v_ocupacion_vuelo ov
GROUP BY ov.aerolinea_codigo, ov.aerolinea_nombre
ORDER BY pct_ocupacion_prom DESC NULLS LAST;


-- --------------------------------------------------------------------
-- VISTA 3: v_resumen_kpis
-- --------------------------------------------------------------------
-- Fila única con los indicadores globales del panel de control.
-- Diseñada para ser consultada con SELECT * FROM v_resumen_kpis
-- y devolver exactamente una fila.
--
-- COLUMNAS:
--   total_vuelos           — cantidad total de vuelos en el catálogo
--   total_asientos         — capacidad total de la flota
--   asientos_ocupados      — asientos con estado = 'ocupado'
--   asientos_libres        — asientos con estado = 'libre'
--   pct_ocupacion_global   — porcentaje de ocupación de toda la flota
--   reservas_confirmadas   — reservas con estado = 'confirmada'
--   vuelos_llenos          — vuelos con pct_ocupacion >= 90
--   aerolineas_activas     — aerolíneas con al menos un vuelo
--
-- IMPLEMENTACIÓN:
--   Usamos subconsultas escalares en el SELECT para que cada KPI sea
--   independiente y legible. El planner puede evaluarlas en paralelo.
--   Alternativa: un single-scan con múltiples COUNT FILTER, más eficiente
--   pero menos pedagógico.
-- --------------------------------------------------------------------

CREATE OR REPLACE VIEW v_resumen_kpis AS
SELECT
    -- Volumen del catálogo
    (SELECT count(*)::int FROM vuelos)                              AS total_vuelos,
    (SELECT count(*)::int FROM asientos)                            AS total_asientos,

    -- Estado de asientos (fuente de verdad: tabla asientos)
    (SELECT count(*)::int FROM asientos WHERE estado = 'ocupado')   AS asientos_ocupados,
    (SELECT count(*)::int FROM asientos WHERE estado = 'libre')     AS asientos_libres,

    -- Ocupación global (evitar /0 con NULLIF)
    ROUND(
        (SELECT count(*) FROM asientos WHERE estado = 'ocupado')
        * 100.0
        / NULLIF((SELECT count(*) FROM asientos), 0)
    )                                                               AS pct_ocupacion_global,

    -- Reservas activas (estado de negocio, distinto del estado del asiento)
    (SELECT count(*)::int FROM reservas WHERE estado = 'confirmada') AS reservas_confirmadas,

    -- Vuelos "llenos" (≥ 90 % de ocupación según v_ocupacion_vuelo)
    (SELECT count(*)::int FROM v_ocupacion_vuelo WHERE pct_ocupacion >= 90) AS vuelos_llenos,

    -- Aerolíneas que tienen al menos un vuelo en el catálogo
    (SELECT count(DISTINCT aerolinea_codigo)::int FROM vuelos
      WHERE aerolinea_codigo IS NOT NULL)                           AS aerolineas_activas;


-- --------------------------------------------------------------------
-- GRANTS — heredar modelo de privilegios de migration 006
-- --------------------------------------------------------------------
-- Las tres vistas son de solo lectura (no contienen DML), por lo que
-- SELECT es el único privilegio relevante.
-- app_consulta: nivel más bajo — solo lectura de reportes (apropiado)
-- app_agente: puede ver reportes para tomar decisiones operativas
-- app_admin: acceso total (ya tiene ALL TABLES, pero lo repetimos por claridad)

GRANT SELECT ON v_ocupacion_vuelo    TO app_consulta, app_agente, app_admin;
GRANT SELECT ON v_ocupacion_aerolinea TO app_consulta, app_agente, app_admin;
GRANT SELECT ON v_resumen_kpis       TO app_consulta, app_agente, app_admin;
