import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/lib/auth";
import {
  escenarioDobleReserva,
  escenarioAislamiento,
  escenarioDeadlock,
} from "@/lib/laboratorio";
import type { ResultadoLab } from "@/lib/laboratorio";

export const dynamic = "force-dynamic";

type EscenarioKey = "doble-reserva" | "aislamiento" | "deadlock";

export async function POST(request: Request): Promise<NextResponse> {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de la solicitud inválido" },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "El cuerpo debe ser un objeto JSON" },
      { status: 400 },
    );
  }

  const { escenario } = body as Record<string, unknown>;

  const VALID_ESCENARIOS: readonly EscenarioKey[] = [
    "doble-reserva",
    "aislamiento",
    "deadlock",
  ];

  if (typeof escenario !== "string" || !VALID_ESCENARIOS.includes(escenario as EscenarioKey)) {
    return NextResponse.json(
      {
        error: `Escenario inválido. Valores permitidos: ${VALID_ESCENARIOS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Build scenario runners closed over the current operator id
  const ESCENARIOS: Record<EscenarioKey, () => Promise<ResultadoLab>> = {
    "doble-reserva": () => escenarioDobleReserva(op.id),
    "aislamiento": escenarioAislamiento,
    "deadlock": escenarioDeadlock,
  };

  const runScenario = ESCENARIOS[escenario as EscenarioKey];

  try {
    const resultado = await runScenario();
    return NextResponse.json({ resultado });
  } catch (err) {
    console.error(`[POST /api/laboratorio] escenario=${escenario}`, err);
    return NextResponse.json(
      { error: "Error ejecutando el escenario de laboratorio" },
      { status: 500 },
    );
  }
}
