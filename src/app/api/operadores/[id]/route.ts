import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/lib/auth";
import {
  actualizarOperador,
  eliminarOperador,
  UsernameConflictError,
} from "@/lib/operadores";
import type { OperatorRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_ROLES: OperatorRole[] = ["agente", "admin", "consulta"];

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (op.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: {
    username?: unknown;
    role?: unknown;
    activo?: unknown;
    password?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de la solicitud inválido" },
      { status: 400 },
    );
  }

  const { username, role, activo, password } = body;

  // Validate only provided fields
  if (username !== undefined && (typeof username !== "string" || !username.trim())) {
    return NextResponse.json(
      { error: "El nombre de usuario no puede estar vacío" },
      { status: 400 },
    );
  }
  if (
    role !== undefined &&
    (typeof role !== "string" || !VALID_ROLES.includes(role as OperatorRole))
  ) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }
  if (activo !== undefined && typeof activo !== "boolean") {
    return NextResponse.json(
      { error: "El campo activo debe ser booleano" },
      { status: 400 },
    );
  }
  if (password !== undefined && (typeof password !== "string" || password.length < 6)) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 },
    );
  }

  try {
    const operador = await actualizarOperador(id, {
      username: typeof username === "string" ? username.trim() : undefined,
      role: typeof role === "string" ? (role as OperatorRole) : undefined,
      activo: typeof activo === "boolean" ? activo : undefined,
      password: typeof password === "string" && password.trim() !== "" ? password : undefined,
    });

    if (!operador) {
      return NextResponse.json(
        { error: "Operador no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ operador });
  } catch (error) {
    if (error instanceof UsernameConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[PATCH /api/operadores/:id]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (op.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // Prevent self-deletion
  if (op.id === id) {
    return NextResponse.json(
      { error: "No podés eliminar tu propio usuario" },
      { status: 400 },
    );
  }

  try {
    const deleted = await eliminarOperador(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Operador no encontrado" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/operadores/:id]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
