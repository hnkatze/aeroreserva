-- Migration 002: flight catalog (airports, flights, seats)
-- Airports use IATA 3-letter codes as natural primary keys.
-- Flights reference two airports (origin != destination, arrival > departure).
-- Seats belong to a flight; the (vuelo_id, numero) pair is unique per flight.
-- Seat estado is denormalized for fast "libre" queries; the authoritative
-- anti-double-booking guarantee lives in the partial UNIQUE index on reservas.

CREATE TABLE IF NOT EXISTS aeropuertos (
  codigo  TEXT PRIMARY KEY CHECK (char_length(codigo) = 3),  -- IATA natural PK
  nombre  TEXT NOT NULL,
  ciudad  TEXT NOT NULL,
  pais    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vuelos (
  id        SERIAL PRIMARY KEY,
  codigo    TEXT NOT NULL UNIQUE,
  origen    TEXT NOT NULL REFERENCES aeropuertos(codigo),
  destino   TEXT NOT NULL REFERENCES aeropuertos(codigo),
  salida    TIMESTAMPTZ NOT NULL,
  llegada   TIMESTAMPTZ NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (destino <> origen),
  CHECK (llegada > salida)
);

CREATE TABLE IF NOT EXISTS asientos (
  id       SERIAL PRIMARY KEY,
  vuelo_id INTEGER NOT NULL REFERENCES vuelos(id) ON DELETE CASCADE,
  numero   TEXT NOT NULL,
  clase    TEXT NOT NULL DEFAULT 'economica'
             CHECK (clase IN ('economica', 'ejecutiva', 'primera')),
  estado   TEXT NOT NULL DEFAULT 'libre'
             CHECK (estado IN ('libre', 'ocupado')),
  UNIQUE (vuelo_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_vuelos_salida ON vuelos(salida);
CREATE INDEX IF NOT EXISTS idx_asientos_vuelo ON asientos(vuelo_id);
