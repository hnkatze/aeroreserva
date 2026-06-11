import { cookies } from "next/headers";
import { query } from "@/lib/db";

export type OperatorRole = "agente" | "admin" | "consulta";

export type PgRole = "app_agente" | "app_admin" | "app_consulta";

export interface SessionOperator {
  id: number;
  username: string;
  role: OperatorRole;
}

/**
 * Whitelist mapping from application operator roles to PostgreSQL NOLOGIN
 * roles defined in migration 006_roles.sql.
 *
 * The result is a closed union — the pg role MUST come from this map and
 * never from raw user input.  This is the sole injection-safe point for
 * anything that ends up in SET LOCAL ROLE.
 */
const PG_ROLE_MAP = {
  agente: "app_agente",
  admin: "app_admin",
  consulta: "app_consulta",
} as const satisfies Record<OperatorRole, PgRole>;

/**
 * Return the PostgreSQL NOLOGIN role for the given application operator role.
 * Only the three values from migration 006 are accepted.
 */
export function operatorRoleToPgRole(role: OperatorRole): PgRole {
  return PG_ROLE_MAP[role];
}

const COOKIE_NAME = "session";
const SESSION_DURATION_HOURS = 8;

/**
 * Create a server-side session row and set the opaque session cookie.
 * The browser never sees operator data — only the session id.
 */
export async function createSession(operadorId: number): Promise<void> {
  const rows = await query<{ id: string }>(
    `INSERT INTO sesiones (operador_id, expira_en)
     VALUES ($1, now() + make_interval(hours => $2))
     RETURNING id`,
    [operadorId, SESSION_DURATION_HOURS],
  );
  const sessionId = rows[0]?.id;
  if (!sessionId) throw new Error("Could not create session");

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_HOURS * 60 * 60,
  });
}

/**
 * Resolve the operator for the current request from the session cookie.
 * Returns null when there is no valid, unexpired session.
 */
export async function getCurrentOperator(): Promise<SessionOperator | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const rows = await query<SessionOperator>(
    `SELECT o.id, o.username, o.role
       FROM sesiones s
       JOIN operadores o ON o.id = s.operador_id
      WHERE s.id = $1 AND s.expira_en > now() AND o.activo = TRUE`,
    [sessionId],
  );
  return rows[0] ?? null;
}

/** Delete the current session row and clear the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) return;

  await query("DELETE FROM sesiones WHERE id = $1", [sessionId]);
  cookieStore.delete(COOKIE_NAME);
}
