import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/lib/auth";
import { listarVuelos } from "@/lib/vuelos";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q") ?? undefined;
  const origen = searchParams.get("origen") ?? undefined;
  const destino = searchParams.get("destino") ?? undefined;
  const fecha = searchParams.get("fecha") ?? undefined;
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Math.min(Math.max(1, Number(rawLimit)), 100) : 20;

  const vuelos = await listarVuelos({ q, origen, destino, fecha, limit });
  return NextResponse.json({ vuelos });
}
