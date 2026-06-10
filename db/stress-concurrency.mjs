// Concurrent-write stress test. Mirrors crearReserva() from src/lib/reservas.ts
// exactly (upsert passenger → SELECT FOR UPDATE → guard → INSERT → UPDATE seat),
// then fires many reservations in parallel to prove the anti-double-booking
// guarantee holds under load. Cleans up after itself.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 30 });
const OPERADOR_ID = 1; // admin (survives the importer --reset)

async function reservar({ vueloId, asientoId, doc, nombre }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const p = await client.query(
      `INSERT INTO pasajeros (documento, nombre) VALUES ($1,$2)
       ON CONFLICT (documento) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
      [doc, nombre],
    );
    const pasajeroId = p.rows[0].id;
    const lock = await client.query(
      `SELECT id FROM asientos WHERE id=$1 AND vuelo_id=$2 FOR UPDATE`,
      [asientoId, vueloId],
    );
    if (lock.rows.length === 0) throw new Error("AsientoNoEncontrado");
    const st = await client.query(`SELECT estado FROM asientos WHERE id=$1`, [asientoId]);
    if (st.rows[0]?.estado === "ocupado") throw new Error("AsientoOcupado");
    try {
      await client.query(
        `INSERT INTO reservas (vuelo_id, asiento_id, pasajero_id, operador_id) VALUES ($1,$2,$3,$4)`,
        [vueloId, asientoId, pasajeroId, OPERADOR_ID],
      );
    } catch (e) {
      if (e.code === "23505" && e.constraint === "ux_reservas_vuelo_asiento")
        throw new Error("AsientoOcupado");
      throw e;
    }
    await client.query(`UPDATE asientos SET estado='ocupado' WHERE id=$1`, [asientoId]);
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, reason: e.message };
  } finally {
    client.release();
  }
}

const freeSeats = async (n) =>
  (await pool.query(`SELECT id, vuelo_id FROM asientos WHERE estado='libre' LIMIT $1`, [n])).rows;

// ── Scenario A: max contention — N agents fight for ONE seat ───────────────
const K = 30;
const [seatA] = await freeSeats(1);
let t0 = Date.now();
const resA = await Promise.all(
  Array.from({ length: K }, (_, i) =>
    reservar({ vueloId: seatA.vuelo_id, asientoId: seatA.id, doc: `STRESS-A-${i}`, nombre: `Agente ${i}` }),
  ),
);
const winsA = resA.filter((r) => r.ok).length;
console.log(`\nA) Contención total — ${K} agentes, MISMO asiento (id ${seatA.id}):`);
console.log(`   ganadores: ${winsA}, rechazados: ${K - winsA}, en ${Date.now() - t0} ms  ${winsA === 1 ? "✅ exactamente 1 gana" : "❌ ESPERABA 1"}`);

// ── Scenario B: throughput — N agents, DISTINCT seats, no contention ───────
const N = 200;
const seatsB = await freeSeats(N);
t0 = Date.now();
const resB = await Promise.all(
  seatsB.map((s, i) => reservar({ vueloId: s.vuelo_id, asientoId: s.id, doc: `STRESS-B-${i}`, nombre: `Pax ${i}` })),
);
const okB = resB.filter((r) => r.ok).length;
const secB = (Date.now() - t0) / 1000;
console.log(`\nB) Throughput — ${N} reservas en asientos DISTINTOS, en paralelo:`);
console.log(`   exitosas: ${okB}/${N} en ${secB.toFixed(2)} s  =>  ${(okB / secB).toFixed(0)} reservas/seg  ${okB === N ? "✅" : "❌"}`);

// ── Scenario C: multi-contention — M seats, C competitors each ─────────────
const M = 10, C = 10;
const seatsC = await freeSeats(M);
const tasksC = [];
seatsC.forEach((s, si) => {
  for (let c = 0; c < C; c++)
    tasksC.push(reservar({ vueloId: s.vuelo_id, asientoId: s.id, doc: `STRESS-C-${si}-${c}`, nombre: `A${si}-${c}` }));
});
t0 = Date.now();
const resC = await Promise.all(tasksC);
const okC = resC.filter((r) => r.ok).length;
console.log(`\nC) Contención múltiple — ${M} asientos × ${C} competidores (${tasksC.length} intentos):`);
console.log(`   ganadores: ${okC} (esperado ${M}), en ${Date.now() - t0} ms  ${okC === M ? "✅ un ganador por asiento" : "❌"}`);

// ── Global integrity check ────────────────────────────────────────────────
const dup = await pool.query(
  `SELECT vuelo_id, asiento_id, count(*) FROM reservas WHERE estado='confirmada'
   GROUP BY vuelo_id, asiento_id HAVING count(*) > 1`,
);
console.log(`\nIntegridad global — asientos con doble reserva confirmada: ${dup.rows.length}  ${dup.rows.length === 0 ? "✅ CERO" : "❌ HAY DOBLES"}`);

// ── Cleanup ────────────────────────────────────────────────────────────────
await pool.query(
  `UPDATE asientos SET estado='libre' WHERE id IN (
     SELECT r.asiento_id FROM reservas r JOIN pasajeros p ON p.id=r.pasajero_id
     WHERE p.documento LIKE 'STRESS-%')`,
);
await pool.query(`DELETE FROM reservas WHERE pasajero_id IN (SELECT id FROM pasajeros WHERE documento LIKE 'STRESS-%')`);
await pool.query(`DELETE FROM pasajeros WHERE documento LIKE 'STRESS-%'`);
console.log("\nCleanup: reservas y pasajeros de prueba eliminados, asientos liberados.");
await pool.end();
