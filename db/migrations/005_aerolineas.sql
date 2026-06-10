-- Migration 005: airlines as a first-class related table
-- Airlines come from OpenFlights airlines.dat. A flight code's alphabetic
-- prefix (e.g. TOM in "TOM1420") is the airline code; vuelos.aerolinea_codigo
-- references aerolineas(codigo). Nullable so pre-existing rows stay valid until
-- backfilled.

CREATE TABLE IF NOT EXISTS aerolineas (
  codigo TEXT PRIMARY KEY,          -- IATA (2) or ICAO (3) code from OpenFlights
  nombre TEXT NOT NULL,
  pais   TEXT
);

ALTER TABLE vuelos
  ADD COLUMN IF NOT EXISTS aerolinea_codigo TEXT REFERENCES aerolineas(codigo);

CREATE INDEX IF NOT EXISTS idx_vuelos_aerolinea ON vuelos(aerolinea_codigo);
