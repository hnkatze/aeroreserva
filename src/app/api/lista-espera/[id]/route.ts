import { NextResponse } from "next/server";
import { getCurrentOperator, operatorRoleToPgRole } from "@/lib/auth";
import { promoverManual, cancelarEspera } from "@/lib/lista-espera";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/lista-espera/:id  — manual promote / cancel a waitlist entry
// Body: { accion: "promover" | "cancelar" }
// ---------------------------------------------------------------------------

export async function PATCH(request: Request, ctx: RouteContext) {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Read-only operators cannot mutate the queue.
  if (op.role === "consulta") {
    return NextResponse.json(
      { error: "Tu rol no permite modificar la lista de espera" },
      { status: 403 },
    );
  }

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: { accion?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de la solicitud inválido" },
      { status: 400 },
    );
  }

  const pgRole = operatorRoleToPgRole(op.role);

  try {
    if (body.accion === "promover") {
      const reservaId = await promoverManual(id, op.id, pgRole);
      if (reservaId === null) {
        return NextResponse.json(
          {
            error: "El vuelo no tiene asientos libres para promover",
            code: "SIN_ASIENTOS",
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ reservaId });
    }

    if (body.accion === "cancelar") {
      const ok = await cancelarEspera(id, pgRole);
      if (!ok) {
        return NextResponse.json(
          { error: "La entrada no existe o ya no está en espera" },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Acción inválida. Use { accion: 'promover' | 'cancelar' }" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[PATCH /api/lista-espera/:id]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
