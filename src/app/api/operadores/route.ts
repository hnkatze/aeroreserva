import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/lib/auth";
import {
  listarOperadores,
  crearOperador,
  UsernameConflictError,
} from "@/lib/operadores";
import type { OperatorRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_ROLES: OperatorRole[] = ["agente", "admin", "consulta"];

export async function GET() {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const operadores = await listarOperadores();
  return NextResponse.json({ operadores });
}

export async function POST(request: Request) {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (op.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { username?: unknown; password?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de la solicitud inválido" },
      { status: 400 },
    );
  }

  const { username, password, role } = body;

  if (typeof username !== "string" || !username.trim()) {
    return NextResponse.json(
      { error: "El nombre de usuario es requerido" },
      { status: 400 },
    );
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 },
    );
  }
  const resolvedRole: OperatorRole =
    typeof role === "string" && VALID_ROLES.includes(role as OperatorRole)
      ? (role as OperatorRole)
      : "agente";

  try {
    const operador = await crearOperador({
      username: username.trim(),
      password,
      role: resolvedRole,
    });
    return NextResponse.json({ operador }, { status: 201 });
  } catch (error) {
    if (error instanceof UsernameConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[POST /api/operadores]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
