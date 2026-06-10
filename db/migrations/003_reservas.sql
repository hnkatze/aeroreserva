-- Migration 003: passengers and reservations
-- Passengers are identified by document number (upsert-safe UNIQUE).
-- Reservations link a seat, a flight, a passenger, and the operator who created it.
-- Cancellation is a soft-cancel: estado='cancelada' keeps audit history.
-- The partial UNIQUE index enforces RN-1: one confirmed reservation per (vuelo, asiento).
-- The constraint name ux_reservas_vuelo_asiento is used in the 23505 mapping in lib.

CREATE TABLE IF NOT EXISTS pasajeros (
  id        SERIAL PRIMARY KEY,
  documento TEXT NOT NULL UNIQUE,
  nombre    TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservas (
  id          SERIAL PRIMARY KEY,
  vuelo_id    INTEGER NOT NULL REFERENCES vuelos(id),
  asiento_id  INTEGER NOT NULL REFERENCES asientos(id),
  pasajero_id INTEGER NOT NULL REFERENCES pasajeros(id),
  operador_id INTEGER NOT NULL REFERENCES operadores(id),
  estado      TEXT NOT NULL DEFAULT 'confirmada'
                CHECK (estado IN ('confirmada', 'cancelada')),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial UNIQUE: only one confirmed reservation per (vuelo, asiento).
-- Cancelled rows are excluded so the same seat can be re-reserved after cancellation.
CREATE UNIQUE INDEX IF NOT EXISTS ux_reservas_vuelo_asiento
  ON reservas(vuelo_id, asiento_id)
  WHERE estado <> 'cancelada';

CREATE INDEX IF NOT EXISTS idx_reservas_vuelo ON reservas(vuelo_id);
