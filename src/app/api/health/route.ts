import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// This handler queries the database on every request, so it must never be
// prerendered or cached.
export const dynamic = "force-dynamic";

interface HealthRow {
  version: string;
  now: Date;
}

export async function GET() {
  try {
    const rows = await query<HealthRow>(
      "SELECT version() AS version, now() AS now",
    );
    return NextResponse.json({
      status: "ok",
      database: "connected",
      version: rows[0]?.version,
      time: rows[0]?.now,
    });
  } catch (error) {
    console.error("[health] database check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        database: "unreachable",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
