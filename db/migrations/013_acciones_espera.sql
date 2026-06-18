-- Migration 013: manual waitlist actions (promote / cancel)
-- ==========================================================================
-- Purpose (didactic): complement the AUTOMATIC promotion trigger from
-- migration 008 with two MANUAL operator actions, both implemented as
-- PL/pgSQL SECURITY DEFINER functions so they respect the least-privilege
-- role model (app_agente only has SELECT on lista_espera).
--
--   promover_manual(p_entrada)  → give the waiting passenger the FIRST free
--                                 seat on their flight, right now.
--   cancelar_espera(p_entrada)  → drop the passenger from the queue and
--                                 close the gap so everyone behind moves up.
--
-- Why SECURITY DEFINER (same reasoning as migration 008):
--   The functions INSERT into reservas, UPDATE asientos and UPDATE
--   lista_espera.  app_agente lacks INSERT/UPDATE on lista_espera, so the
--   function runs as its owner (postgres) to perform the write regardless of
--   the calling role.  Access control still happens at the API layer
--   (only agente/admin operators may call these).
-- ==========================================================================


-- --------------------------------------------------------------------------
-- 1. promover_manual — assign the first free seat to a waiting passenger
-- --------------------------------------------------------------------------
-- Returns the new reservas.id on success, or NULL when the flight has no
-- free seat (the caller surfaces that as a user-visible message).
--
-- Concurrency: the free seat is picked with FOR UPDATE SKIP LOCKED so two
-- concurrent manual promotions on the same flight grab DIFFERENT seats
-- instead of fighting over one (mirrors the trigger in migration 008).
--
-- The operator is read from app.current_operator (set by the app inside the
-- transaction, same mechanism as crearReserva / the promotion trigger).

CREATE OR REPLACE FUNCTION promover_manual(p_entrada INTEGER)
  RETURNS INTEGER            -- new reserva id, or NULL if no free seat
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_espera     lista_espera%ROWTYPE;
  v_asiento_id INTEGER;
  v_operador   INTEGER;
  v_reserva_id INTEGER;
BEGIN
  -- a) Lock and validate the waitlist entry.
  SELECT *
    INTO v_espera
    FROM lista_espera
   WHERE id = p_entrada
   FOR UPDATE;

  IF NOT FOUND OR v_espera.estado <> 'esperando' THEN
    RAISE EXCEPTION 'La entrada % no está en espera', p_entrada
      USING ERRCODE = 'P0002';
  END IF;

  -- b) Pick the first free seat on the flight (deterministic by numero).
  SELECT id
    INTO v_asiento_id
    FROM asientos
   WHERE vuelo_id = v_espera.vuelo_id
     AND estado   = 'libre'
   ORDER BY numero
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  -- No free seat → signal the caller without raising (NULL = "vuelo lleno").
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- c) Resolve the operator from the session GUC set by the application.
  v_operador := NULLIF(current_setting('app.current_operator', true), '')::integer;
  IF v_operador IS NULL THEN
    RAISE EXCEPTION 'app.current_operator no está definido'
      USING ERRCODE = 'P0003';
  END IF;

  -- d) Create the confirmed reservation on that seat.
  INSERT INTO reservas (vuelo_id, asiento_id, pasajero_id, operador_id, estado)
  VALUES (
    v_espera.vuelo_id,
    v_asiento_id,
    v_espera.pasajero_id,
    v_operador,
    'confirmada'
  )
  RETURNING id INTO v_reserva_id;

  -- e) Mark the seat occupied. This sets 'libre' → 'ocupado', so it does NOT
  --    fire trg_promover_espera (that trigger only reacts to 'ocupado' →
  --    'libre'), avoiding any double-promotion.
  UPDATE asientos
     SET estado = 'ocupado'
   WHERE id = v_asiento_id;

  -- f) Mark the waitlist entry as promoted and close the gap behind it.
  UPDATE lista_espera
     SET estado = 'promovida'
   WHERE id = p_entrada;

  UPDATE lista_espera
     SET posicion = posicion - 1
   WHERE vuelo_id = v_espera.vuelo_id
     AND estado   = 'esperando'
     AND posicion > v_espera.posicion;

  RETURN v_reserva_id;
END;
$$;


-- --------------------------------------------------------------------------
-- 2. cancelar_espera — withdraw a passenger from the queue
-- --------------------------------------------------------------------------
-- Returns TRUE when an 'esperando' entry was cancelled, FALSE when the entry
-- does not exist or is not currently waiting (already promoted/cancelled).
--
-- After cancelling, every passenger BEHIND the cancelled one moves up a
-- position so the queue has no gaps — this is the "se sube solo" behaviour:
-- the next in line automatically becomes position 1.

CREATE OR REPLACE FUNCTION cancelar_espera(p_entrada INTEGER)
  RETURNS BOOLEAN
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_espera lista_espera%ROWTYPE;
BEGIN
  SELECT *
    INTO v_espera
    FROM lista_espera
   WHERE id = p_entrada
   FOR UPDATE;

  IF NOT FOUND OR v_espera.estado <> 'esperando' THEN
    RETURN FALSE;
  END IF;

  UPDATE lista_espera
     SET estado = 'cancelada'
   WHERE id = p_entrada;

  -- Close the gap: everyone behind moves up one position.
  UPDATE lista_espera
     SET posicion = posicion - 1
   WHERE vuelo_id = v_espera.vuelo_id
     AND estado   = 'esperando'
     AND posicion > v_espera.posicion;

  RETURN TRUE;
END;
$$;
