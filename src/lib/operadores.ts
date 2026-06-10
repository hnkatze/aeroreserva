import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { OperatorRole } from "@/lib/auth";

export interface Operador {
  id: number;
  username: string;
  role: OperatorRole;
  activo: boolean;
  creado_en: Date;
}

export interface OperadorDetalle extends Operador {
  actualizado_en: Date | null;
}

export interface CrearOperadorInput {
  username: string;
  password: string;
  role?: OperatorRole;
}

export interface ActualizarOperadorInput {
  username?: string;
  role?: OperatorRole;
  activo?: boolean;
  password?: string;
}

export class UsernameConflictError extends Error {
  constructor(username: string) {
    super(`El nombre de usuario "${username}" ya está en uso`);
    this.name = "UsernameConflictError";
  }
}

export interface ListarOperadoresOpts {
  /** Maximum number of records to return. Defaults to 25. */
  limit?: number;
  /** Number of records to skip. Defaults to 0. */
  offset?: number;
}

/**
 * Return a paginated list of operators without exposing password_hash.
 * Defaults: limit = 25, offset = 0.
 */
export async function listarOperadores(
  opts: ListarOperadoresOpts = {},
): Promise<Operador[]> {
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  return query<Operador>(
    `SELECT id, username, role, activo, creado_en
       FROM operadores
      ORDER BY creado_en DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
}

/**
 * Return the total count of operators.
 * Used for pagination metadata.
 */
export async function contarOperadores(): Promise<number> {
  const rows = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM operadores`,
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Return a single operator by id without exposing password_hash.
 */
export async function obtenerOperador(id: number): Promise<Operador | null> {
  const rows = await query<Operador>(
    `SELECT id, username, role, activo, creado_en
       FROM operadores
      WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Create a new operator. Hashes the plain password before storing.
 * Throws UsernameConflictError if the username is already taken.
 */
export async function crearOperador(
  input: CrearOperadorInput,
): Promise<Operador> {
  const { username, password, role = "agente" } = input;
  const password_hash = hashPassword(password);

  try {
    const rows = await query<Operador>(
      `INSERT INTO operadores (username, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role, activo, creado_en`,
      [username, password_hash, role],
    );
    const created = rows[0];
    if (!created) throw new Error("No se pudo crear el operador");
    return created;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      throw new UsernameConflictError(username);
    }
    throw error;
  }
}

/**
 * Update an existing operator. Re-hashes password only if provided.
 * Throws UsernameConflictError if the new username is already taken.
 */
export async function actualizarOperador(
  id: number,
  input: ActualizarOperadorInput,
): Promise<Operador | null> {
  const { username, role, activo, password } = input;

  // Build dynamic SET clause only for provided fields
  const setClauses: string[] = ["actualizado_en = now()"];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (username !== undefined) {
    setClauses.push(`username = $${paramIndex++}`);
    params.push(username);
  }
  if (role !== undefined) {
    setClauses.push(`role = $${paramIndex++}`);
    params.push(role);
  }
  if (activo !== undefined) {
    setClauses.push(`activo = $${paramIndex++}`);
    params.push(activo);
  }
  if (password !== undefined && password.trim() !== "") {
    setClauses.push(`password_hash = $${paramIndex++}`);
    params.push(hashPassword(password));
  }

  // Nothing to update besides the timestamp
  if (setClauses.length === 1) {
    return obtenerOperador(id);
  }

  params.push(id);

  try {
    const rows = await query<Operador>(
      `UPDATE operadores
          SET ${setClauses.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, username, role, activo, creado_en`,
      params,
    );
    return rows[0] ?? null;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      throw new UsernameConflictError(username ?? "");
    }
    throw error;
  }
}

/**
 * Delete an operator by id. Returns true if a row was deleted.
 */
export async function eliminarOperador(id: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `DELETE FROM operadores WHERE id = $1 RETURNING id`,
    [id],
  );
  return (rows[0]?.id ?? null) !== null;
}
