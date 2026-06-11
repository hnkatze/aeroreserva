import { getCurrentOperator } from "@/lib/auth";
import { queryRaw } from "@/lib/db";
import { QUERY_LOG_ENABLED } from "@/lib/query-log";

export const dynamic = "force-dynamic";

interface ExplainRow {
  "QUERY PLAN": string;
}

export async function POST(request: Request): Promise<Response> {
  if (!QUERY_LOG_ENABLED) {
    return new Response(JSON.stringify({ error: "Not available" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const op = await getCurrentOperator();
  if (!op) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { sql?: unknown; params?: unknown };
  try {
    body = (await request.json()) as { sql?: unknown; params?: unknown };
  } catch {
    return new Response(
      JSON.stringify({ error: "Cuerpo de la solicitud inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { sql, params } = body;

  if (typeof sql !== "string" || !sql.trim()) {
    return new Response(
      JSON.stringify({ error: "El campo sql es requerido y debe ser un string no vacío" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const safeParams =
    Array.isArray(params) ? (params as unknown[]) : undefined;

  // Determine the statement kind from the first word.
  const firstWord = sql.trimStart().split(/\s+/)[0]?.toUpperCase() ?? "";
  const isReadOnly = firstWord === "SELECT";

  // ANALYZE executes the query — only safe for SELECTs.
  // For writes (INSERT/UPDATE/DELETE/etc.) we explain WITHOUT ANALYZE so no
  // rows are actually mutated.
  const explainSql = isReadOnly
    ? `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`
    : `EXPLAIN (FORMAT TEXT) ${sql}`;

  try {
    // queryRaw bypasses the query log so EXPLAIN never pollutes the log buffer.
    const result = await queryRaw<ExplainRow>(explainSql, safeParams);
    const plan = result.rows.map((r) => r["QUERY PLAN"]).join("\n");
    return new Response(JSON.stringify({ plan }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
}
