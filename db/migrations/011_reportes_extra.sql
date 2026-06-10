-- Migration 011: Vistas de reportes adicionales
-- ====================================================================
-- Propósito (material didáctico): ampliar el panel de reportes con
-- cuatro vistas analíticas nuevas que extienden el modelo de 009 y 010.
--
-- VISTAS NUEVAS:
--   v_vuelos_por_estado    — distribución de vuelos por estado operativo
--   v_ocupacion_ruta       — ocupación media por par origen→destino
--   v_retraso_aerolinea    — métricas de puntualidad por aerolínea
--   v_top_aeropuertos      — tráfico total (salidas + llegadas) por aeropuerto
--
-- NOTAS DE PERFORMANCE:
--   v_vuelos_por_estado: GROUP BY sobre ~6.667 filas con índice en estado
--     (creado en 010) → Index Scan + Sort, muy rápido.
--   v_ocupacion_ruta: agrega sobre v_ocupacion_vuelo; dado que esa vista
--     ya hace el scan de asientos (1M filas), agregar a nivel ruta es barato
--     (O(vuelos) = O(6.667)). Limitamos en la app, no en la vista.
--   v_retraso_aerolinea: solo lee la tabla vuelos (~6.667 filas) y agrupa
--     por aerolinea_codigo (5 valores) → Hash Aggregate trivial.
--   v_top_aeropuertos: dos escans de vuelos (salidas y llegadas) con UNION
--     ALL más un agregado → O(2 × vuelos) = O(13.334). JOIN a aeropuertos
--     (100-300 filas) es trivial.
--
-- GRANT: igual que migration 009 — los tres roles operativos.
-- ====================================================================


-- --------------------------------------------------------------------
-- VISTA 1: v_vuelos_por_estado
-- --------------------------------------------------------------------
-- Distribución de vuelos por cada valor de `estado`.
-- Útil para el panel operativo: ¿cuántos vuelos están programados,
-- retrasados, cancelados, etc.?
--
-- COLUMNAS:
--   estado           — valor del campo vuelos.estado
--   cantidad_vuelos  — número de vuelos en ese estado
--   pct_total        — porcentaje sobre el total de vuelos (redondeado)
--
-- PLAN ESPERADO:
--   HashAggregate sobre ~6.667 filas usando idx_vuelos_estado (010).
--   Tiempo esperado: < 5 ms.
-- --------------------------------------------------------------------

CREATE OR REPLACE VIEW v_vuelos_por_estado AS
SELECT
    v.estado,
    COUNT(*)                                              AS cantidad_vuelos,
    -- Porcentaje sobre el total; NULLIF protege si la tabla está vacía.
    ROUND(
        COUNT(*) * 100.0
        / NULLIF((SELECT COUNT(*) FROM vuelos), 0)
    )                                                     AS pct_total
FROM vuelos v
GROUP BY v.estado
ORDER BY cantidad_vuelos DESC;


-- --------------------------------------------------------------------
-- VISTA 2: v_ocupacion_ruta
-- --------------------------------------------------------------------
-- Métricas de ocupación agregadas por par origen→destino.
-- Muestra cuáles rutas tienen más demanda y cuántos vuelos las cubren.
--
-- COLUMNAS:
--   origen           — código IATA del aeropuerto de salida
--   destino          — código IATA del aeropuerto de llegada
--   cantidad_vuelos  — número de vuelos que operan esa ruta
--   total_asientos   — capacidad total sumada de todos los vuelos de la ruta
--   asientos_ocupados — asientos ocupados totales en la ruta
--   pct_ocupacion_prom — ocupación promedio ponderada (no promedio de promedios)
--                        Igual al criterio de v_ocupacion_aerolinea: refleja
--                        la realidad operativa (una ruta con vuelos de
--                        distinta capacidad se pondera por tamaño).
--
-- PLAN ESPERADO:
--   Agrega sobre v_ocupacion_vuelo (~6.667 filas ya reducidas desde asientos).
--   HashAggregate con clave (origen, destino) — muy rápido.
-- --------------------------------------------------------------------

CREATE OR REPLACE VIEW v_ocupacion_ruta AS
SELECT
    ov.origen,
    ov.destino,
    COUNT(*)                                              AS cantidad_vuelos,
    SUM(ov.total_asientos)                                AS total_asientos,
    SUM(ov.ocupados)                                      AS asientos_ocupados,
    ROUND(
        SUM(ov.ocupados) * 100.0
        / NULLIF(SUM(ov.total_asientos), 0)
    )                                                     AS pct_ocupacion_prom
FROM v_ocupacion_vuelo ov
GROUP BY ov.origen, ov.destino
ORDER BY pct_ocupacion_prom DESC NULLS LAST, cantidad_vuelos DESC;


-- --------------------------------------------------------------------
-- VISTA 3: v_retraso_aerolinea
-- --------------------------------------------------------------------
-- Métricas de puntualidad por aerolínea.
-- Responde: ¿qué aerolínea retrasa más vuelos? ¿cuánto demora en promedio?
--
-- COLUMNAS:
--   aerolinea_codigo    — código IATA de la aerolínea
--   aerolinea_nombre    — nombre completo (JOIN a aerolineas)
--   total_vuelos        — vuelos totales operados por la aerolínea
--   vuelos_retrasados   — vuelos con estado = 'retrasado'
--   pct_retrasados      — % de vuelos retrasados sobre el total
--   retraso_min_prom    — retraso promedio en minutos calculado sobre
--                         TODOS los vuelos (incluyendo los no retrasados,
--                         cuyo retraso_min = 0). Esto refleja el impacto
--                         real en el total de la operación.
--                         Para ver solo el promedio de los efectivamente
--                         retrasados, filtrar WHERE estado = 'retrasado'
--                         en la app. Documentamos ambas semánticas aquí.
--   retraso_min_prom_retrasados — retraso promedio solo sobre vuelos con
--                         estado = 'retrasado'. Útil para comparar la
--                         "gravedad" de los retrasos entre aerolíneas.
--
-- PLAN ESPERADO:
--   HashAggregate sobre vuelos (6.667 filas) JOIN aerolineas (5 filas).
--   Tiempo esperado: < 10 ms.
-- --------------------------------------------------------------------

CREATE OR REPLACE VIEW v_retraso_aerolinea AS
SELECT
    v.aerolinea_codigo,
    a.nombre                                                   AS aerolinea_nombre,
    COUNT(*)                                                   AS total_vuelos,
    COUNT(*) FILTER (WHERE v.estado = 'retrasado')             AS vuelos_retrasados,
    ROUND(
        COUNT(*) FILTER (WHERE v.estado = 'retrasado')
        * 100.0
        / NULLIF(COUNT(*), 0)
    )                                                          AS pct_retrasados,
    -- Promedio sobre TODOS los vuelos (los no retrasados contribuyen con 0)
    ROUND(AVG(v.retraso_min))                                  AS retraso_min_prom,
    -- Promedio solo sobre los efectivamente retrasados (NULL si ninguno)
    ROUND(
        AVG(v.retraso_min) FILTER (WHERE v.estado = 'retrasado')
    )                                                          AS retraso_min_prom_retrasados
FROM vuelos v
LEFT JOIN aerolineas a ON a.codigo = v.aerolinea_codigo
WHERE v.aerolinea_codigo IS NOT NULL
GROUP BY v.aerolinea_codigo, a.nombre
ORDER BY pct_retrasados DESC NULLS LAST, vuelos_retrasados DESC;


-- --------------------------------------------------------------------
-- VISTA 4: v_top_aeropuertos
-- --------------------------------------------------------------------
-- Tráfico total por aeropuerto (salidas + llegadas).
-- Permite identificar los hubs más activos de la red.
--
-- COLUMNAS:
--   codigo           — código IATA del aeropuerto
--   nombre           — nombre completo del aeropuerto (JOIN a aeropuertos)
--   ciudad           — ciudad del aeropuerto
--   pais             — país del aeropuerto
--   vuelos_salientes — vuelos cuyo origen es este aeropuerto
--   vuelos_entrantes — vuelos cuyo destino es este aeropuerto
--   trafico_total    — salientes + entrantes (métrica principal de hub)
--
-- IMPLEMENTACIÓN:
--   Unimos dos agregaciones sobre vuelos (salidas y llegadas) con FULL OUTER
--   JOIN para capturar aeropuertos que solo aparecen en una dirección.
--   COALESCE maneja los NULLs del FULL OUTER JOIN.
--   JOIN final a aeropuertos enriquece con nombre/ciudad/país.
--
-- PLAN ESPERADO:
--   Dos HashAggregates sobre vuelos + FULL OUTER JOIN entre ellos + Hash Join
--   con aeropuertos (100-300 filas). Total: O(2 × 6.667) = O(13.334 filas).
--   Tiempo esperado: 10-20 ms.
-- --------------------------------------------------------------------

CREATE OR REPLACE VIEW v_top_aeropuertos AS
SELECT
    ap.codigo,
    ap.nombre,
    ap.ciudad,
    ap.pais,
    COALESCE(sal.vuelos_salientes, 0)                     AS vuelos_salientes,
    COALESCE(ent.vuelos_entrantes, 0)                     AS vuelos_entrantes,
    COALESCE(sal.vuelos_salientes, 0)
        + COALESCE(ent.vuelos_entrantes, 0)               AS trafico_total
FROM aeropuertos ap
LEFT JOIN (
    -- Vuelos salientes por aeropuerto de origen
    SELECT origen AS codigo, COUNT(*) AS vuelos_salientes
    FROM vuelos
    GROUP BY origen
) sal ON sal.codigo = ap.codigo
LEFT JOIN (
    -- Vuelos entrantes por aeropuerto de destino
    SELECT destino AS codigo, COUNT(*) AS vuelos_entrantes
    FROM vuelos
    GROUP BY destino
) ent ON ent.codigo = ap.codigo
-- Solo aeropuertos con algún movimiento
WHERE COALESCE(sal.vuelos_salientes, 0) + COALESCE(ent.vuelos_entrantes, 0) > 0
ORDER BY trafico_total DESC;


-- --------------------------------------------------------------------
-- GRANTS — mismos roles que migration 009
-- --------------------------------------------------------------------

GRANT SELECT ON v_vuelos_por_estado  TO app_consulta, app_agente, app_admin;
GRANT SELECT ON v_ocupacion_ruta     TO app_consulta, app_agente, app_admin;
GRANT SELECT ON v_retraso_aerolinea  TO app_consulta, app_agente, app_admin;
GRANT SELECT ON v_top_aeropuertos    TO app_consulta, app_agente, app_admin;
