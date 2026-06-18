import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/lib/auth";
import { QUERY_LOG_ENABLED, getSnapshot } from "@/lib/query-log";

export const dynamic = "force-dynamic";

/**
 * Returns the current in-memory query-log buffer (transaction queries only).
 * On-demand snapshot — the drawer fetches this when opened and via "Actualizar".
 * Dev-only: returns an empty list in production.
 */
export async function GET() {
  if (!QUERY_LOG_ENABLED) {
    return NextResponse.json({ entries: [] });
  }

  const op = await getCurrentOperator();
  if (!op) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  return NextResponse.json({ entries: await getSnapshot() });
}
