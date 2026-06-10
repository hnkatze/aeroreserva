import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, type OperatorRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface OperatorRow {
  id: number;
  username: string;
  password_hash: string;
  role: OperatorRole;
}

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { username, password } = body;
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username ||
    !password
  ) {
    return NextResponse.json(
      { error: "Usuario y contraseña son requeridos" },
      { status: 400 },
    );
  }

  const rows = await query<OperatorRow>(
    "SELECT id, username, password_hash, role FROM operadores WHERE username = $1 AND activo = TRUE",
    [username],
  );
  const operator = rows[0];

  // Same response for unknown user and wrong password — don't leak which failed.
  if (!operator || !verifyPassword(password, operator.password_hash)) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  await createSession(operator.id);
  return NextResponse.json({
    operator: { id: operator.id, username: operator.username, role: operator.role },
  });
}
