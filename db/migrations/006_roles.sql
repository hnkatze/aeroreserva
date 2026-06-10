-- Migration 006: PostgreSQL database roles (NOLOGIN — privilege sets)
-- =======================================================================
-- Purpose (didactic): demonstrate the GRANT/REVOKE privilege model by
-- defining three roles that map to the application-level access tiers
-- described in the project spec.  These roles are NOT login roles; they
-- are sets of privileges that can be activated with SET ROLE.
--
-- Role hierarchy (conceptual — implemented as explicit grants for clarity):
--
--   app_consulta  ⊂  app_agente  ⊂  app_admin
--
-- In a production database you could express this with GRANT app_consulta
-- TO app_agente and GRANT app_agente TO app_admin (role membership), which
-- lets PostgreSQL inherit privileges automatically.  Here we grant each
-- role its privileges explicitly so every GRANT line is self-documenting
-- and easy to audit during the presentation.
--
-- IMPORTANT: No REVOKE is performed on the 'postgres' superuser or on the
-- 'public' schema/role, so the application connection pool (which runs as
-- postgres) is completely unaffected.
-- =======================================================================


-- -----------------------------------------------------------------------
-- 1. Create roles (idempotent)
-- -----------------------------------------------------------------------
-- DO block checks pg_roles before issuing CREATE ROLE, so re-applying
-- the migration is safe (no "role already exists" error).

DO $$
BEGIN
  -- Read-only tier: suitable for reporting dashboards, BI tools, etc.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_consulta') THEN
    CREATE ROLE app_consulta NOLOGIN;
  END IF;

  -- Operational tier: travel agents who manage bookings but must not
  -- touch authentication data (operadores / sesiones).
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_agente') THEN
    CREATE ROLE app_agente NOLOGIN;
  END IF;

  -- Administrative tier: full access to all tables and sequences.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
    CREATE ROLE app_admin NOLOGIN;
  END IF;
END
$$;


-- -----------------------------------------------------------------------
-- 2. Schema-level USAGE (required before any table privilege takes effect)
-- -----------------------------------------------------------------------
-- Without USAGE ON SCHEMA public a role cannot resolve table names even
-- if it has SELECT on individual tables.

GRANT USAGE ON SCHEMA public TO app_consulta, app_agente, app_admin;


-- -----------------------------------------------------------------------
-- 3. app_consulta — read-only access to business data
-- -----------------------------------------------------------------------
-- Allowed: view flights, seats, reservations, passengers, airports,
--          airlines.  This is enough to generate reports or answer
--          customer-service queries without any risk of modification.
-- Denied:  any write (INSERT/UPDATE/DELETE/TRUNCATE), all DDL,
--          and zero visibility into auth tables (operadores, sesiones).

GRANT SELECT ON aeropuertos  TO app_consulta;
GRANT SELECT ON aerolineas   TO app_consulta;
GRANT SELECT ON vuelos       TO app_consulta;
GRANT SELECT ON asientos     TO app_consulta;
GRANT SELECT ON reservas     TO app_consulta;
GRANT SELECT ON pasajeros    TO app_consulta;


-- -----------------------------------------------------------------------
-- 4. app_agente — reservation operations
-- -----------------------------------------------------------------------
-- Allowed: read catalogue (airports, airlines, flights); manage seat
--          state (mark occupied/libre); create and update reservations
--          and passengers; use the relevant sequences so SERIAL PKs work.
-- Denied:  DELETE (no permanent removal of business records),
--          auth tables (operadores, sesiones), other sequences.
--
-- The USAGE + SELECT on sequences is mandatory when a role does INSERT on
-- a SERIAL column: USAGE allows nextval(); SELECT allows currval().

GRANT SELECT            ON aeropuertos TO app_agente;
GRANT SELECT            ON aerolineas  TO app_agente;
GRANT SELECT            ON vuelos      TO app_agente;
GRANT SELECT, UPDATE    ON asientos    TO app_agente;
GRANT SELECT, INSERT, UPDATE ON reservas   TO app_agente;
GRANT SELECT, INSERT, UPDATE ON pasajeros  TO app_agente;

GRANT USAGE, SELECT ON SEQUENCE reservas_id_seq  TO app_agente;
GRANT USAGE, SELECT ON SEQUENCE pasajeros_id_seq TO app_agente;


-- -----------------------------------------------------------------------
-- 5. app_admin — full access to all tables and sequences
-- -----------------------------------------------------------------------
-- Allowed: everything — including auth tables, DDL-adjacent operations
--          (TRUNCATE), and all sequences.  In practice this role would be
--          reserved for maintenance scripts, data migrations, and the
--          database administrator.
-- Note:    ALL TABLES / ALL SEQUENCES captures every object currently in
--          the schema.  New tables added in future migrations will need an
--          explicit GRANT (or a DEFAULT PRIVILEGES rule, not shown here).

GRANT ALL ON ALL TABLES    IN SCHEMA public TO app_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_admin;
