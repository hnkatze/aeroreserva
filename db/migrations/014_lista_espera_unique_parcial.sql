-- Migration 014: make the waitlist uniqueness PARTIAL
-- ==========================================================================
-- Bug: migration 008 declared a TOTAL unique constraint
--   uq_lista_espera_vuelo_pasajero UNIQUE (vuelo_id, pasajero_id)
-- which covers EVERY state (esperando / promovida / cancelada).  That means
-- once a passenger has been promoted or has withdrawn, they can NEVER be
-- enqueued again for that flight — the row still occupies the (vuelo, pasajero)
-- slot and re-enqueuing fails with 23505, even though they are no longer
-- actively waiting and the entry is hidden from the UI.
--
-- Fix: replace it with a PARTIAL unique index restricted to estado='esperando',
-- mirroring ux_reservas_vuelo_asiento in migration 003.  The rule becomes:
-- "a passenger appears at most once ACTIVELY WAITING per flight", while
-- promoted/cancelled history rows no longer block a fresh enqueue.
--
-- The new index name (ux_*) matches the reservas convention; the POST handler
-- in lib detects the 23505 on this name to surface "ya está en la lista".
-- ==========================================================================

ALTER TABLE lista_espera
  DROP CONSTRAINT IF EXISTS uq_lista_espera_vuelo_pasajero;

CREATE UNIQUE INDEX IF NOT EXISTS ux_lista_espera_vuelo_pasajero
  ON lista_espera (vuelo_id, pasajero_id)
  WHERE estado = 'esperando';
