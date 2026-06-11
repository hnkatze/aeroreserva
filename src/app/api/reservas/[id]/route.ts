import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/lib/auth";
import { cancelarReserva, obtenerReservaDetalle } from "@/lib/reservas";
import { obtenerAuditoriaDeRegistro } from "@/lib/bitacora";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteContext) {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const reserva = await obtenerReservaDetalle(id);
    if (!reserva) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 },
      );
    }
    const auditoria = await obtenerAuditoriaDeRegistro("reservas", String(id));
    return NextResponse.json({ reserva, auditoria });
  } catch (error) {
    console.error("[GET /api/reservas/:id]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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

  if (body.accion !== "cancelar") {
    return NextResponse.json(
      { error: "Acción inválida. Use { accion: 'cancelar' }" },
      { status: 400 },
    );
  }

  try {
    const reserva = await cancelarReserva(id);
    if (!reserva) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json({ reserva });
  } catch (error) {
    console.error("[PATCH /api/reservas/:id]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
