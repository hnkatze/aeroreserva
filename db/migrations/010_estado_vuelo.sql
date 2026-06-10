-- Migration 010: Columnas de estado y retraso en vuelos
-- =======================================================================
-- Propósito (material didáctico): agregar información operativa a la tabla
-- vuelos para demostrar estados de vuelo y métricas de puntualidad.
--
-- DISEÑO:
--   estado      TEXT con CHECK constraint → claridad semántica y
--               validación a nivel de DB sin necesidad de un tipo ENUM.
--               Un ENUM es más eficiente pero menos flexible para alterar;
--               TEXT + CHECK es la elección pragmática en proyectos académicos.
--
--   retraso_min INTEGER NOT NULL DEFAULT 0 → dominio >= 0; un retraso
--               negativo no tiene sentido operativo. El DEFAULT 0 garantiza
--               que las filas existentes queden en "sin retraso" tras el ALTER.
--
-- RETROCOMPATIBILIDAD:
--   ADD COLUMN IF NOT EXISTS → idempotente; puede ejecutarse múltiples veces.
--   Los DEFAULT permiten que todas las filas existentes queden válidas.
--   Las vistas de 009_reportes.sql no seleccionan columnas de vuelos
--   excepto id, codigo, origen, destino, aerolinea_codigo → no se rompen.
-- =======================================================================

-- --------------------------------------------------------------------
-- 1. Columna de estado operativo
-- --------------------------------------------------------------------
-- Estados del ciclo de vida de un vuelo:
--   programado  — en vuelo planificado, aún no activo
--   abordando   — embarque en curso
--   despegado   — en vuelo
--   aterrizado  — llegó a destino
--   retrasado   — salida demorada (ver retraso_min)
--   cancelado   — vuelo suspendido

ALTER TABLE vuelos
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'programado'
  CHECK (estado IN ('programado','abordando','despegado','aterrizado','retrasado','cancelado'));

-- --------------------------------------------------------------------
-- 2. Columna de retraso en minutos
-- --------------------------------------------------------------------
-- Solo aplica semánticamente cuando estado = 'retrasado', pero se
-- mantiene en la misma tabla para simplificar consultas y evitar NULLs.
-- El CHECK asegura el dominio no-negativo.

ALTER TABLE vuelos
  ADD COLUMN IF NOT EXISTS retraso_min INTEGER NOT NULL DEFAULT 0
  CHECK (retraso_min >= 0);

-- --------------------------------------------------------------------
-- 3. Índice sobre estado
-- --------------------------------------------------------------------
-- Permite filtrar vuelos por estado (ej. panel de operaciones)
-- con Index Scan en lugar de Seq Scan sobre 6667 filas.
-- IF NOT EXISTS → idempotente.

CREATE INDEX IF NOT EXISTS idx_vuelos_estado ON vuelos (estado);
