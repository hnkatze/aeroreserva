-- Migration 001: authentication (operators + sessions)
-- Operators are the system users (travel agents, airline counter staff, admins).
-- End passengers are NOT authenticated — that is out of scope per the proposal.

CREATE TABLE IF NOT EXISTS operadores (
  id             SERIAL PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'agente'
                   CHECK (role IN ('agente', 'admin', 'consulta')),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Server-side sessions. The browser only holds an opaque cookie (the session id);
-- the source of truth lives here, in the database.
CREATE TABLE IF NOT EXISTS sesiones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id INTEGER NOT NULL REFERENCES operadores(id) ON DELETE CASCADE,
  creada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sesiones_operador ON sesiones (operador_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones (expira_en);
