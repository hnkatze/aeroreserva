import { cookies } from "next/headers";
import { query } from "@/lib/db";

export type OperatorRole = "agente" | "admin" | "consulta";

export interface SessionOperator {
  id: number;
  username: string;
  role: OperatorRole;
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
