import { NextResponse } from "next/server";
import { getCurrentOperator, operatorRoleToPgRole } from "@/lib/auth";
import {
  crearReserva,
  listarReservas,
  AsientoOcupadoError,
  VueloNoEncontradoError,
  AsientoNoEncontradoError,
} from "@/lib/reservas";

export const dynamic = "force-dynamic";

export async function GET() {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const reservas = await listarReservas();
  return NextResponse.json({ reservas });
}

export async function POST(request: Request) {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: {
    vuelo_id?: unknown;
    asiento_id?: unknown;
    pasajero?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de la solicitud inválido" },
      { status: 400 },
    );
  }

  const { vuelo_id, asiento_id, pasajero } = body;

  if (typeof vuelo_id !== "number") {
    return NextResponse.json(
      { error: "El campo vuelo_id es requerido y debe ser un número" },
      { status: 400 },
    );
  }
  if (typeof asiento_id !== "number") {
    return NextResponse.json(
      { error: "El campo asiento_id es requerido y debe ser un número" },
      { status: 400 },
    );
  }
  if (typeof pasajero !== "object" || pasajero === null) {
    return NextResponse.json(
      { error: "El campo pasajero es requerido" },
      { status: 400 },
    );
  }

  const { nombre, documento } = pasajero as Record<string, unknown>;

  if (typeof nombre !== "string" || !nombre.trim()) {
    return NextResponse.json(
      { error: "El campo pasajero.nombre es requerido" },
      { status: 400 },
    );
  }
  if (typeof documento !== "string" || !documento.trim()) {
    return NextResponse.json(
      { error: "El campo pasajero.documento es requerido" },
      { status: 400 },
    );
  }

  try {
    const reserva = await crearReserva({
      vueloId: vuelo_id,
      asientoId: asiento_id,
      pasajero: { nombre: nombre.trim(), documento: documento.trim() },
      operadorId: op.id,
      pgRole: operatorRoleToPgRole(op.role),
    });
    return NextResponse.json({ reserva }, { status: 201 });
  } catch (error) {
    if (error instanceof AsientoOcupadoError) {
      return NextResponse.json(
        { error: error.message, code: "ASIENTO_OCUPADO" },
        { status: 409 },
      );
    }
    if (
      error instanceof VueloNoEncontradoError ||
      error instanceof AsientoNoEncontradoError
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[POST /api/reservas]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
