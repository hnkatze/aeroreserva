// Performance benchmark against the loaded catalog. Read-only except for a
// temporary index it creates and drops to show the before/after effect.
// Run: node --env-file=.env.local db/benchmark.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── helpers ────────────────────────────────────────────────────────────────
async function timeIt(label, sql, params = [], runs = 5) {
  // Warm up once (caches plan + buffers), then average N runs.
  await pool.query(sql, params);
  const times = [];
  for (let i = 0; i < runs; i++) {
    const t0 = Date.now();
    const res = await pool.query(sql, params);
    times.push(Date.now() - t0);
    var rows = res.rowCount;
  }
  times.sort((a, b) => a - b);
  const avg = (times.reduce((a, b) => a + b, 0) / runs).toFixed(1);
  console.log(
    `  ${label.padEnd(42)} avg ${String(avg).padStart(7)} ms  (min ${times[0]}, max ${times[runs - 1]})  rows=${rows}`,
  );
  return Number(avg);
}

async function plan(label, sql, params = []) {
  const res = await pool.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
    params,
  );
  const text = res.rows.map((r) => r["QUERY PLAN"]).join("\n");
  const scan = /Seq Scan/.test(text)
    ? "⚠️  SEQ SCAN"
    : /Index Only Scan/.test(text)
      ? "✅ Index Only Scan"
      : /Index Scan/.test(text)
        ? "✅ Index Scan"
        : "—";
  const exec = /Execution Time: ([\d.]+) ms/.exec(text);
  console.log(`  ${label.padEnd(42)} ${scan.padEnd(18)} exec ${exec ? exec[1] : "?"} ms`);
  return text;
}

// ── run ──────────────────────────────────────────────────────────────────
console.log("\n=== Volume ===");
for (const t of ["aeropuertos", "vuelos", "asientos", "reservas"]) {
  const r = await pool.query(`SELECT count(*)::int AS n FROM ${t}`);
  console.log(`  ${t.padEnd(14)} ${r.rows[0].n.toLocaleString("en-US")}`);
}

// pick a real flight that has seats
const { rows: fr } = await pool.query(`SELECT id FROM vuelos ORDER BY id LIMIT 1`);
const vueloId = fr[0].id;

console.log("\n=== Latency (real app queries) ===");
await timeIt("listarVuelos  (ALL, no pagination)", `SELECT id, codigo, origen, destino, salida, llegada FROM vuelos ORDER BY salida ASC`);
await timeIt("listarVuelos  (paginated LIMIT 50)", `SELECT id, codigo, origen, destino, salida, llegada FROM vuelos ORDER BY salida ASC LIMIT 50 OFFSET 0`);
await timeIt("listarAsientosDeVuelo (soloLibres)", `SELECT id, vuelo_id, numero, clase, estado FROM asientos WHERE vuelo_id = $1 AND estado = 'libre' ORDER BY id ASC`, [vueloId]);
await timeIt("seat lock (crearReserva FOR UPDATE)", `SELECT id FROM asientos WHERE id = $1 AND vuelo_id = $2`, [1, vueloId]);
await timeIt("listarReservas (joins)", `SELECT r.id, r.estado, r.creado_en, p.nombre, v.codigo, a.numero FROM reservas r JOIN pasajeros p ON p.id=r.pasajero_id JOIN vuelos v ON v.id=r.vuelo_id JOIN asientos a ON a.id=r.asiento_id ORDER BY r.creado_en DESC`);
await timeIt("COUNT(*) asientos (full table)", `SELECT count(*) FROM asientos`);

console.log("\n=== Query plans (current schema) ===");
await plan("listarVuelos (ALL)", `SELECT id, codigo, origen, destino, salida, llegada FROM vuelos ORDER BY salida ASC`);
await plan("listarAsientosDeVuelo (soloLibres)", `SELECT id, vuelo_id, numero, clase, estado FROM asientos WHERE vuelo_id = $1 AND estado = 'libre' ORDER BY id ASC`, [vueloId]);

console.log("\n=== Before/after: partial index on asientos(vuelo_id) WHERE estado='libre' ===");
const before = await timeIt("asientos soloLibres  BEFORE index", `SELECT id, vuelo_id, numero, clase, estado FROM asientos WHERE vuelo_id = $1 AND estado = 'libre' ORDER BY id ASC`, [vueloId]);
await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS tmp_idx_asientos_libres ON asientos(vuelo_id, id) WHERE estado = 'libre'`);
await plan("asientos soloLibres  WITH index", `SELECT id, vuelo_id, numero, clase, estado FROM asientos WHERE vuelo_id = $1 AND estado = 'libre' ORDER BY id ASC`, [vueloId]);
const after = await timeIt("asientos soloLibres  AFTER index", `SELECT id, vuelo_id, numero, clase, estado FROM asientos WHERE vuelo_id = $1 AND estado = 'libre' ORDER BY id ASC`, [vueloId]);
await pool.query(`DROP INDEX IF EXISTS tmp_idx_asientos_libres`);
console.log(`  → improvement: ${before} ms → ${after} ms (${before > 0 ? (((before - after) / before) * 100).toFixed(0) : 0}% faster)`);

await pool.end();
console.log("\nDone.");
