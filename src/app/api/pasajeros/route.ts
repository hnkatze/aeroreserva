import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/lib/auth";
import { buscarPasajeros } from "@/lib/pasajeros";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q") ?? "";
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Math.min(Math.max(1, Number(rawLimit)), 50) : 20;

  const pasajeros = await buscarPasajeros(q, limit);
  return NextResponse.json({ pasajeros });
}
