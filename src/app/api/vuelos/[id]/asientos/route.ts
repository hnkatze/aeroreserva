import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/lib/auth";
import { listarAsientosDeVuelo } from "@/lib/asientos";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: idStr } = await ctx.params;
  const vueloId = parseInt(idStr, 10);
  if (isNaN(vueloId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const soloLibresParam = searchParams.get("soloLibres");
  const soloLibres = soloLibresParam === "true" || soloLibresParam === "1";

  const asientos = await listarAsientosDeVuelo(vueloId, { soloLibres });

  // listarAsientosDeVuelo returns an empty array when the flight does not exist
  // (no rows match WHERE vuelo_id = $1). When the result is empty we check
  // whether the flight itself exists to distinguish 404 from "no seats yet".
  if (asientos.length === 0) {
    const rows = await query<{ id: number }>(
      `SELECT id FROM vuelos WHERE id = $1`,
      [vueloId],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Vuelo no encontrado" }, { status: 404 });
    }
  }

  return NextResponse.json({ asientos });
}
