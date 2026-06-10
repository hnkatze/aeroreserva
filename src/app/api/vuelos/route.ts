import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/lib/auth";
import { listarVuelos } from "@/lib/vuelos";

export const dynamic = "force-dynamic";

export async function GET() {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const vuelos = await listarVuelos();
  return NextResponse.json({ vuelos });
}
