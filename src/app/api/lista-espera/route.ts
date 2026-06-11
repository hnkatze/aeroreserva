import { NextResponse } from "next/server";
import { getCurrentOperator, operatorRoleToPgRole } from "@/lib/auth";
import { encolarEnEspera } from "@/lib/lista-espera";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Internal helper — mirrors isPgError from src/lib/reservas.ts
// ---------------------------------------------------------------------------

function isPgError(
  error: unknown,
): error is { code: string; constraint?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

// ---------------------------------------------------------------------------
// POST /api/lista-espera
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: {
    vuelo_id?: unknown;
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

  const { vuelo_id, pasajero } = body;

  if (typeof vuelo_id !== "number") {
    return NextResponse.json(
      { error: "El campo vuelo_id es requerido y debe ser un número" },
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
    const entrada = await encolarEnEspera({
      vueloId: vuelo_id,
      pasajero: { nombre: nombre.trim(), documento: documento.trim() },
      pgRole: operatorRoleToPgRole(op.role),
    });
    return NextResponse.json({ entrada }, { status: 201 });
  } catch (error) {
    if (
      isPgError(error) &&
      error.code === "23505" &&
      error.constraint === "uq_lista_espera_vuelo_pasajero"
    ) {
      return NextResponse.json(
        {
          error: "El pasajero ya está en la lista de espera de este vuelo",
          code: "YA_EN_ESPERA",
        },
        { status: 409 },
      );
    }
    console.error("[POST /api/lista-espera]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
