-- Migration 012: Grant fixes for post-006 tables and role threading
-- =======================================================================
-- Purpose (didactic): document and fix two privilege gaps discovered when
-- wiring SET LOCAL ROLE into the application layer (src/lib/db.ts).
--
-- Background
-- ----------
-- Migration 006 grants app_admin ALL ON ALL TABLES IN SCHEMA public at
-- migration time.  PostgreSQL GRANT ALL ON ALL TABLES is a SNAPSHOT — it
-- covers only tables that EXIST at the time the statement executes.  Tables
-- created in later migrations (007 bitacora, 008 lista_espera) are NOT
-- automatically covered.  Each later migration must grant its own tables
-- explicitly.  Migration 008 grants app_agente SELECT on lista_espera and
-- app_admin SELECT,INSERT,UPDATE — this file adds the missing INSERT for
-- app_agente and brings bitacora up to the same standard.
--
-- Gap 1: app_agente cannot INSERT directly into lista_espera
-- ----------------------------------------------------------
-- Migration 006 (written before migration 008 existed) grants app_agente
-- only SELECT on lista_espera (granted in migration 008).  The application
-- works around this via the SECURITY DEFINER function encolar_espera()
-- (also in migration 008), which executes as postgres regardless of the
-- caller's role.  That workaround is intentional and documented there.
--
-- However, granting direct INSERT to app_agente is cleaner long-term and
-- removes the dependency on the SECURITY DEFINER escape hatch for simple
-- enqueue operations.
--
-- Gap 2: app_admin is missing privileges on bitacora and lista_espera
-- -------------------------------------------------------------------
-- Because GRANT ALL ON ALL TABLES IN SCHEMA public (migration 006) was
-- applied BEFORE bitacora and lista_espera were created, app_admin has no
-- direct privileges on those tables (it relies on the superuser session
-- when pgRole is not set).  Under SET LOCAL ROLE app_admin the application
-- can now reach those tables — this migration brings them in.
--
-- NOTE: This migration has NOT been applied to the database.
-- Apply manually with:
--   psql $DATABASE_URL -f db/migrations/012_grants_fix.sql
-- =======================================================================


-- -----------------------------------------------------------------------
-- 1. app_agente — grant direct INSERT + UPDATE on lista_espera
-- -----------------------------------------------------------------------
-- Allows app_agente to INSERT into lista_espera directly, consistent with
-- the intent of migration 006 (app_agente manages booking operations).
-- The SECURITY DEFINER function encolar_espera() remains usable as an
-- alternative; this grant just removes the requirement for it.

GRANT SELECT, INSERT, UPDATE ON lista_espera TO app_agente;


-- -----------------------------------------------------------------------
-- 2. app_admin — grant ALL on tables created after migration 006
-- -----------------------------------------------------------------------
-- bitacora: created in migration 007
-- lista_espera: created in migration 008

GRANT ALL ON bitacora    TO app_admin;
GRANT ALL ON lista_espera TO app_admin;

-- Sequences for the above tables
GRANT ALL ON SEQUENCE bitacora_id_seq     TO app_admin;
-- lista_espera_id_seq was already granted in migration 008; re-stating is idempotent
GRANT ALL ON SEQUENCE lista_espera_id_seq TO app_admin;


-- -----------------------------------------------------------------------
-- 3. app_consulta — read access to bitacora (audit log reporting)
-- -----------------------------------------------------------------------
-- Allows read-only operators to query the audit trail, consistent with
-- their SELECT-only tier on all business tables.

GRANT SELECT ON bitacora TO app_consulta;
