-- Migration 008: waitlist (lista_espera) with automatic PL/pgSQL promotion
-- ==========================================================================
-- Purpose (didactic): demonstrate how a database trigger can implement
-- complex business logic — here, automatic seat allocation — completely
-- inside PostgreSQL, without any application-layer coordination.
--
-- The key idea: when a confirmed reservation is cancelled the application
-- sets the seat to 'libre'.  That asientos UPDATE fires our trigger, which
-- atomically promotes the FIRST waiting passenger on the same flight:
--   - creates a new confirmed reservation on that seat
--   - re-marks the seat as 'ocupado'
--   - marks the lista_espera entry as 'promovida'
-- Everything happens inside the same transaction as the cancellation.
--
-- Key design decisions explained for the academic presentation:
--
--  1. UNIQUE(vuelo_id, pasajero_id)
--     --------------------------------
--     A passenger can appear at most once per flight in the waitlist.
--     This prevents double-enqueuing from a UI bug or a retry.
--
--  2. posicion — explicit ordering column
--     ------------------------------------
--     We use an explicit INTEGER rather than relying on insertion order
--     (ctid) or a sequence, because:
--       a) It is deterministic across vacuums and table rewrites.
--       b) It allows future re-ordering (priority lanes, VIP) without
--          changing the trigger logic.
--     The next posicion is COALESCE(MAX(posicion), 0) + 1 per (vuelo_id).
--
--  3. FOR UPDATE SKIP LOCKED in the promotion trigger
--     --------------------------------------------------
--     When multiple concurrent transactions free seats on the same flight
--     simultaneously, two triggers could race to promote the same waitlist
--     row.  FOR UPDATE acquires a row-level lock; SKIP LOCKED skips rows
--     already locked by another transaction, so each trigger promotes a
--     DIFFERENT passenger — no double-promotion, no blocking.
--
--  4. SECURITY DEFINER
--     ------------------
--     The trigger function must INSERT into reservas and UPDATE asientos
--     and lista_espera.  If the cancellation is performed by app_agente
--     (which has limited INSERT privileges), SECURITY DEFINER elevates
--     execution to the function owner (postgres) so the promotion succeeds
--     regardless of caller privilege.
--     This mirrors the pattern established in migration 007 (registrar_bitacora).
--
--  5. Why trigger on asientos, not reservas?
--     ----------------------------------------
--     cancelarReserva (lib/reservas.ts) first UPDATEs reservas.estado to
--     'cancelada', THEN UPDATEs asientos.estado to 'libre'.  If the trigger
--     fired on the reservas UPDATE the seat would still be 'ocupado' at
--     trigger time, and a subsequent app-level UPDATE to 'libre' would
--     overwrite the trigger's re-occupation.  By firing on the asientos
--     UPDATE (libre transition) the trigger sees the seat already freed and
--     can re-occupy it in the same statement — no overwrite race.
--
--     The trigger checks that a cancelled reservation exists for this seat
--     + flight before promoting, so it only fires during a real cancellation
--     flow, not on any arbitrary seat state change.
-- ==========================================================================


-- --------------------------------------------------------------------------
-- 1. Waitlist table
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lista_espera (
  id           SERIAL       PRIMARY KEY,
  vuelo_id     INTEGER      NOT NULL REFERENCES vuelos(id),
  pasajero_id  INTEGER      NOT NULL REFERENCES pasajeros(id),

  -- Explicit ordering column (see design note #2 above).
  -- Lower posicion = higher priority.  Ties within a flight are broken by id.
  posicion     INTEGER      NOT NULL,

  -- Lifecycle states:
  --   esperando  → passenger is waiting for a seat
  --   promovida  → trigger promoted this entry; a new reserva exists
  --   cancelada  → passenger withdrew from the waitlist
  estado       TEXT         NOT NULL DEFAULT 'esperando'
                            CHECK (estado IN ('esperando', 'promovida', 'cancelada')),

  creado_en    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- A passenger appears at most once per flight (active or promoted).
  CONSTRAINT uq_lista_espera_vuelo_pasajero UNIQUE (vuelo_id, pasajero_id)
);

-- Composite index: the promotion trigger always queries by (vuelo_id ORDER BY posicion).
CREATE INDEX IF NOT EXISTS idx_lista_espera_vuelo
  ON lista_espera (vuelo_id, posicion);


-- --------------------------------------------------------------------------
-- 2. Promotion trigger function
-- --------------------------------------------------------------------------
-- This is the academic centrepiece: pure PL/pgSQL promotion logic,
-- zero application code required.
--
-- Trigger: AFTER UPDATE OF estado ON asientos
-- Fires when: NEW.estado = 'libre' AND OLD.estado = 'ocupado'
--             AND a cancelled reservation exists for this seat + flight
--
-- Execution flow inside the function:
--   a) Confirm the seat was freed by a cancellation (not an unrelated event).
--   b) Find the first waiting entry for this flight (SKIP LOCKED — note #3).
--   c) If found: create a new confirmed reservation on this seat.
--   d) Re-mark the seat as 'ocupado'.
--   e) Mark the waitlist entry as 'promovida'.
--   f) If nobody is waiting: return — seat stays libre.

CREATE OR REPLACE FUNCTION promover_lista_espera()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER          -- see design note #4
AS $$
DECLARE
  -- The just-cancelled reservation that freed this seat
  v_reserva_cancelada   reservas%ROWTYPE;

  -- The first waiting passenger for this flight (row-locked for concurrency)
  v_espera              lista_espera%ROWTYPE;

  -- The operador that cancelled, reused for the promoted reservation
  v_operador_id         INTEGER;
BEGIN
  -- -----------------------------------------------------------------------
  -- a) Find the most-recently cancelled reservation for this seat+flight.
  --    This guard ensures the trigger only acts on a real cancellation,
  --    not on a hypothetical direct UPDATE to asientos.estado.
  --    We order by id DESC so we get the most recent cancellation first.
  -- -----------------------------------------------------------------------
  SELECT *
    INTO v_reserva_cancelada
    FROM reservas
   WHERE asiento_id = NEW.id
     AND estado     = 'cancelada'
   ORDER BY id DESC
   LIMIT 1;

  -- If no cancelled reservation found, this is an unrelated estado change —
  -- e.g., an initial setup or manual correction.  Do nothing.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- -----------------------------------------------------------------------
  -- b) Find and lock the first waiting entry for this flight.
  --    FOR UPDATE SKIP LOCKED: skips rows already locked by a racing
  --    concurrent cancellation so each trigger picks a DIFFERENT passenger.
  -- -----------------------------------------------------------------------
  SELECT *
    INTO v_espera
    FROM lista_espera
   WHERE vuelo_id = v_reserva_cancelada.vuelo_id
     AND estado   = 'esperando'
   ORDER BY posicion, id        -- deterministic tiebreak
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  -- If no one is waiting for this flight, nothing to do.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- -----------------------------------------------------------------------
  -- c) Recover the operator from the session variable (same mechanism as
  --    migration 007 / registrar_bitacora).  If not set, fall back to the
  --    operator of the cancelled reservation.
  -- -----------------------------------------------------------------------
  v_operador_id := COALESCE(
    NULLIF(current_setting('app.current_operator', true), '')::integer,
    v_reserva_cancelada.operador_id
  );

  -- -----------------------------------------------------------------------
  -- d) Create a new CONFIRMED reservation for the promoted passenger on
  --    this seat (NEW.id = the seat that just became libre).
  --    We do NOT reuse the cancelled reservation row — a new row keeps
  --    the audit trail clean: cancelled row stays cancelled, promoted row
  --    is a fresh INSERT with its own creado_en timestamp.
  -- -----------------------------------------------------------------------
  INSERT INTO reservas (vuelo_id, asiento_id, pasajero_id, operador_id, estado)
  VALUES (
    v_reserva_cancelada.vuelo_id,
    NEW.id,
    v_espera.pasajero_id,
    v_operador_id,
    'confirmada'
  );

  -- -----------------------------------------------------------------------
  -- e) Re-mark the seat as 'ocupado'.
  --    The trigger fires AFTER the asientos UPDATE (that set it 'libre'),
  --    so we update it again here.  Both updates are inside the same
  --    statement batch and the same transaction — fully atomic.
  -- -----------------------------------------------------------------------
  UPDATE asientos
     SET estado = 'ocupado'
   WHERE id = NEW.id;

  -- -----------------------------------------------------------------------
  -- f) Mark this waitlist entry as 'promovida' so it no longer appears
  --    in the active queue.
  -- -----------------------------------------------------------------------
  UPDATE lista_espera
     SET estado = 'promovida'
   WHERE id = v_espera.id;

  -- For AFTER triggers the return value is ignored by the executor; we
  -- return NEW by convention (mirrors registrar_bitacora style).
  RETURN NEW;
END;
$$;


-- --------------------------------------------------------------------------
-- 3. Attach the trigger to asientos
-- --------------------------------------------------------------------------
-- Fires when a seat transitions from 'ocupado' to 'libre' — i.e., when
-- the application layer frees it during a cancellation.
-- The WHEN clause restricts to just that transition; unrelated updates
-- (e.g., updating clase or numero) never fire the trigger.

DROP TRIGGER IF EXISTS trg_promover_espera ON asientos;

CREATE TRIGGER trg_promover_espera
  AFTER UPDATE OF estado ON asientos
  FOR EACH ROW
  WHEN (NEW.estado = 'libre' AND OLD.estado = 'ocupado')
  EXECUTE FUNCTION promover_lista_espera();

-- Also drop the version targeting reservas if it was applied previously
DROP TRIGGER IF EXISTS trg_promover_espera ON reservas;


-- --------------------------------------------------------------------------
-- 4. Helper function: enqueue a passenger on the waitlist
-- --------------------------------------------------------------------------
-- encolar_espera(p_vuelo, p_pasajero) calculates the next posicion as
-- COALESCE(MAX, 0) + 1 for the given flight and inserts a new row.
-- Returns the new lista_espera.id.
--
-- SECURITY DEFINER: mirrors the promotion function so limited-privilege
-- roles (app_agente) can call it without needing INSERT on lista_espera.

CREATE OR REPLACE FUNCTION encolar_espera(
  p_vuelo     INTEGER,
  p_pasajero  INTEGER
)
  RETURNS INTEGER           -- returns the new lista_espera.id
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_posicion   INTEGER;
  v_id         INTEGER;
BEGIN
  -- Calculate next posicion: 1 if the flight has no waitlist yet.
  SELECT COALESCE(MAX(posicion), 0) + 1
    INTO v_posicion
    FROM lista_espera
   WHERE vuelo_id = p_vuelo;

  INSERT INTO lista_espera (vuelo_id, pasajero_id, posicion)
  VALUES (p_vuelo, p_pasajero, v_posicion)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- --------------------------------------------------------------------------
-- 5. Grant privileges consistent with migration 006
-- --------------------------------------------------------------------------
-- app_consulta: read-only (reports, UI listing)
-- app_agente  : can read and insert (enqueue passengers from the UI)
-- app_admin   : full access

GRANT SELECT ON lista_espera TO app_consulta;
GRANT SELECT ON lista_espera TO app_agente;
GRANT SELECT, INSERT, UPDATE ON lista_espera TO app_admin;

-- app_agente needs the sequence to INSERT (SERIAL PK)
GRANT USAGE, SELECT ON SEQUENCE lista_espera_id_seq TO app_agente;
GRANT USAGE, SELECT ON SEQUENCE lista_espera_id_seq TO app_admin;
