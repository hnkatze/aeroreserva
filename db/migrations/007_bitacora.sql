-- Migration 007: audit log table (bitacora) with PL/pgSQL triggers
-- =======================================================================
-- Purpose (didactic): every INSERT / UPDATE / DELETE on the core domain
-- tables (reservas, asientos, pasajeros) is automatically recorded in
-- bitacora by a trigger.  No application code change is required to get
-- auditing — the database enforces it.
--
-- Key design decisions explained here for the academic presentation:
--
--  1. SECURITY DEFINER on the trigger function
--     ----------------------------------------
--     The function executes with the privileges of the *owner* (postgres),
--     not the invoking role.  This matters when we have limited-privilege
--     roles (app_agente, app_consulta) defined in migration 006: those
--     roles have no INSERT privilege on bitacora, yet their changes must
--     still be recorded.  SECURITY DEFINER is the standard PostgreSQL
--     solution to this cross-privilege write pattern.
--
--  2. current_setting('app.current_operator', true)
--     -----------------------------------------------
--     The application layer can call
--       SET LOCAL app.current_operator = '<id>';
--     inside a transaction, and the trigger reads it via current_setting().
--     The second argument (true = missing_ok) prevents an error when the
--     variable was never set — it returns '' instead.  NULLIF converts the
--     empty string to NULL so unidentified transactions record NULL.
--
--  3. to_jsonb(OLD) / to_jsonb(NEW)
--     --------------------------------
--     Postgres serialises the full row record to JSONB automatically.
--     For INSERT  → datos_anteriores = NULL  (no previous state)
--     For DELETE  → datos_nuevos     = NULL  (no future state)
--     For UPDATE  → both columns are populated (before / after snapshot)
--
--  4. RETURN COALESCE(NEW, OLD)
--     --------------------------
--     AFTER triggers can return NULL for row-level triggers on data-
--     modifying statements without causing a problem (the return value
--     is ignored for AFTER).  Returning COALESCE(NEW, OLD) is nonetheless
--     idiomatic and avoids confusion.
-- =======================================================================


-- -----------------------------------------------------------------------
-- 1. Audit log table
-- -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bitacora (
  id                SERIAL      PRIMARY KEY,
  tabla             TEXT        NOT NULL,
  operacion         TEXT        NOT NULL
                    CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
  registro_id       TEXT,
  -- datos_anteriores: NULL on INSERT (no prior state exists)
  datos_anteriores  JSONB,
  -- datos_nuevos: NULL on DELETE (the row no longer exists)
  datos_nuevos      JSONB,
  -- usuario_bd: the PostgreSQL role that fired the statement
  usuario_bd        TEXT        NOT NULL DEFAULT current_user,
  -- operador_id: application-level operator read from session variable
  -- (set via SET LOCAL app.current_operator = '<id>' inside a transaction)
  operador_id       INTEGER,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by table name (common filter in the audit UI)
CREATE INDEX IF NOT EXISTS idx_bitacora_tabla   ON bitacora (tabla);

-- Fast lookup for chronological queries (default sort in the UI)
CREATE INDEX IF NOT EXISTS idx_bitacora_creado  ON bitacora (creado_en DESC);


-- -----------------------------------------------------------------------
-- 2. Trigger function
-- -----------------------------------------------------------------------
-- SECURITY DEFINER: executes as the function owner (postgres superuser).
-- This is the key that lets limited-privilege roles (app_agente, etc.)
-- have their changes recorded even though they have no INSERT on bitacora.
-- Without SECURITY DEFINER, a trigger fired by app_agente would fail with
-- "permission denied for table bitacora".

CREATE OR REPLACE FUNCTION registrar_bitacora()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_registro_id    TEXT;
  v_datos_ant      JSONB;
  v_datos_nvo      JSONB;
  v_operador_id    INTEGER;
BEGIN
  -- Determine which row ID to record.
  -- All three audited tables (reservas, asientos, pasajeros) have a SERIAL
  -- column named "id", so this cast is safe for all of them.
  v_registro_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.id::text
    ELSE                       NEW.id::text
  END;

  -- Capture before / after snapshots as JSONB.
  -- to_jsonb() serialises the full row record, including all columns.
  v_datos_ant := CASE
    WHEN TG_OP = 'INSERT' THEN NULL
    ELSE                       to_jsonb(OLD)
  END;

  v_datos_nvo := CASE
    WHEN TG_OP = 'DELETE' THEN NULL
    ELSE                       to_jsonb(NEW)
  END;

  -- Read the application operator from the session variable.
  -- current_setting(..., true) returns '' when the variable is not set
  -- instead of raising an error (the second argument = missing_ok).
  -- NULLIF converts the empty string to NULL so rows without an active
  -- operator context store NULL rather than a cast-error placeholder.
  v_operador_id := NULLIF(
    current_setting('app.current_operator', true),
    ''
  )::integer;

  INSERT INTO bitacora (
    tabla,
    operacion,
    registro_id,
    datos_anteriores,
    datos_nuevos,
    operador_id
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_registro_id,
    v_datos_ant,
    v_datos_nvo,
    v_operador_id
  );

  -- AFTER triggers: the return value is ignored by the executor, but
  -- returning COALESCE(NEW, OLD) is idiomatic and works for all three ops.
  RETURN COALESCE(NEW, OLD);
END;
$$;


-- -----------------------------------------------------------------------
-- 3. Attach triggers to the core domain tables
-- -----------------------------------------------------------------------
-- We audit only the tables that participate in the reservation workflow:
--   reservas  — bookings lifecycle (create, cancel)
--   asientos  — seat state transitions (libre → ocupado → libre)
--   pasajeros — passenger upserts

-- reservas
DROP TRIGGER IF EXISTS trg_audit_reservas ON reservas;
CREATE TRIGGER trg_audit_reservas
  AFTER INSERT OR UPDATE OR DELETE ON reservas
  FOR EACH ROW EXECUTE FUNCTION registrar_bitacora();

-- asientos
DROP TRIGGER IF EXISTS trg_audit_asientos ON asientos;
CREATE TRIGGER trg_audit_asientos
  AFTER INSERT OR UPDATE OR DELETE ON asientos
  FOR EACH ROW EXECUTE FUNCTION registrar_bitacora();

-- pasajeros
DROP TRIGGER IF EXISTS trg_audit_pasajeros ON pasajeros;
CREATE TRIGGER trg_audit_pasajeros
  AFTER INSERT OR UPDATE OR DELETE ON pasajeros
  FOR EACH ROW EXECUTE FUNCTION registrar_bitacora();


-- -----------------------------------------------------------------------
-- 4. Grant SELECT on bitacora to application roles
-- -----------------------------------------------------------------------
-- The audit log is readable by all three tiers so the /auditoria page
-- works regardless of which role is active.  Write access is intentionally
-- NOT granted — only the SECURITY DEFINER trigger function may INSERT.

GRANT SELECT ON bitacora            TO app_consulta, app_agente, app_admin;
GRANT USAGE, SELECT ON SEQUENCE bitacora_id_seq TO app_admin;
