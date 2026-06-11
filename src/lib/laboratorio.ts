import { Pool } from "pg";
import type { PoolClient } from "pg";

// ── Dedicated pool (never modifies db.ts) ────────────────────────────────────

const globalForLab = globalThis as unknown as { __labPool?: Pool };

function getLabPool(): Pool {
  if (globalForLab.__labPool) return globalForLab.__labPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and restart the dev server.",
    );
  }

  const pool = new Pool({ connectionString, max: 6 });
  globalForLab.__labPool = pool;
  return pool;
}

// ── Event log types ───────────────────────────────────────────────────────────

export interface EventoLab {
  t: number; // ms elapsed since scenario start
  actor: "T1" | "T2" | "sistema";
  mensaje: string;
  sql?: string;
  nivel?: "info" | "lock" | "error" | "ok";
}

export interface ResultadoLab {
  escenario: string;
  descripcion: string;
  eventos: EventoLab[];
  conclusion: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Primitive mutex so the two async "threads" can yield control to each other. */
class Signal {
  private _resolve: (() => void) | null = null;
  private _promise: Promise<void>;

  constructor() {
    this._promise = new Promise<void>((r) => {
      this._resolve = r;
    });
  }

  wait(): Promise<void> {
    return this._promise;
  }

  fire(): void {
    this._resolve?.();
  }
}

interface PgError {
  code: string;
  message: string;
  constraint?: string;
}

function isPgError(err: unknown): err is PgError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  );
}

// ── Scenario 1: Doble reserva (pessimistic lock) ──────────────────────────────

/**
 * Picks a real FREE seat. T1 and T2 both try to grab it with SELECT FOR UPDATE.
 * T2 blocks while T1 holds the lock, then inserts a reservation. After T1
 * commits, T2 unblocks, re-checks the seat, finds it occupied, and rolls back.
 *
 * Cleanup: after both transactions finish, a dedicated connection runs cleanup
 * inside its own BEGIN/COMMIT (with ROLLBACK on failure) so zero residue remains
 * even if a cleanup step throws.
 */
export async function escenarioDobleReserva(operadorId: number): Promise<ResultadoLab> {
  const pool = getLabPool();
  const eventos: EventoLab[] = [];
  const start = Date.now();

  function log(
    actor: EventoLab["actor"],
    mensaje: string,
    opts?: { sql?: string; nivel?: EventoLab["nivel"] },
  ): void {
    eventos.push({ t: Date.now() - start, actor, mensaje, ...opts });
  }

  let c1: PoolClient | null = null;
  let c2: PoolClient | null = null;

  // Find a free seat to use as the contested resource
  const scout = await pool.connect();
  let asientoId: number;
  let asientoNumero: string;
  try {
    const res = await scout.query<{ id: number; numero: string }>(
      `SELECT a.id, a.numero
         FROM asientos a
        WHERE a.estado = 'libre'
        ORDER BY a.id ASC
        LIMIT 1`,
    );
    const row = res.rows[0];
    if (!row) throw new Error("No free seats found in the database");
    asientoId = row.id;
    asientoNumero = row.numero;
    log("sistema", `Asiento seleccionado para el experimento: ${asientoNumero} (id=${asientoId})`, {
      nivel: "info",
    });
  } finally {
    scout.release();
  }

  // Signal: T1 notifies T2 that the lock is held (T2 can now attempt FOR UPDATE)
  const t1HasLock = new Signal();

  let reservaId: number | null = null;

  // T1 — acquires the lock, inserts the reservation, commits. Cleanup is NOT here.
  const runT1 = async (): Promise<void> => {
    c1 = await pool.connect();
    try {
      log("T1", "BEGIN", { sql: "BEGIN;", nivel: "info" });
      await c1.query("BEGIN");

      log("T1", `SELECT … FOR UPDATE en asiento ${asientoNumero}`, {
        sql: `SELECT id, estado FROM asientos WHERE id = ${asientoId} FOR UPDATE;`,
        nivel: "info",
      });
      await c1.query("SELECT id, estado FROM asientos WHERE id = $1 FOR UPDATE", [asientoId]);
      log("T1", "Lock adquirido — T2 se bloqueará si intenta el mismo asiento", {
        nivel: "ok",
      });

      // Signal T2 to start — it will block on FOR UPDATE
      t1HasLock.fire();

      // Hold the lock long enough so T2 visibly blocks
      await delay(600);

      // Upsert the lab passenger (documento prefixed PWLAB- for easy cleanup)
      const docLab = `PWLAB-${asientoId}`;
      log("T1", `INSERT / upsert pasajero de prueba (doc: ${docLab})`, {
        sql: `INSERT INTO pasajeros (documento, nombre)
  VALUES ('${docLab}', 'Lab Pasajero')
  ON CONFLICT (documento) DO UPDATE SET nombre = EXCLUDED.nombre
  RETURNING id;`,
        nivel: "info",
      });
      const pRes = await c1.query<{ id: number }>(
        `INSERT INTO pasajeros (documento, nombre)
         VALUES ($1, 'Lab Pasajero')
         ON CONFLICT (documento) DO UPDATE SET nombre = EXCLUDED.nombre
         RETURNING id`,
        [docLab],
      );
      const pasajeroId = pRes.rows[0]?.id;
      if (!pasajeroId) throw new Error("Could not upsert lab passenger");

      // Insert reservation
      log("T1", "INSERT reserva confirmada", {
        sql: `INSERT INTO reservas (vuelo_id, asiento_id, pasajero_id, operador_id)
  VALUES (…, ${asientoId}, ${pasajeroId}, ${operadorId}) RETURNING id;`,
        nivel: "info",
      });
      // Get the vuelo_id for this seat
      const vRes = await c1.query<{ vuelo_id: number }>(
        "SELECT vuelo_id FROM asientos WHERE id = $1",
        [asientoId],
      );
      const vueloId = vRes.rows[0]?.vuelo_id;
      if (!vueloId) throw new Error("Could not determine vuelo_id");

      const rRes = await c1.query<{ id: number }>(
        `INSERT INTO reservas (vuelo_id, asiento_id, pasajero_id, operador_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [vueloId, asientoId, pasajeroId, operadorId],
      );
      const insertedId = rRes.rows[0]?.id;
      if (!insertedId) throw new Error("INSERT reserva returned no row");
      reservaId = insertedId;

      // Mark seat occupied
      await c1.query("UPDATE asientos SET estado = 'ocupado' WHERE id = $1", [asientoId]);
      log("T1", "UPDATE asientos estado = 'ocupado'", {
        sql: `UPDATE asientos SET estado = 'ocupado' WHERE id = ${asientoId};`,
        nivel: "info",
      });

      await c1.query("COMMIT");
      log("T1", "COMMIT — reserva creada, seat bloqueado permanentemente", {
        sql: "COMMIT;",
        nivel: "ok",
      });
    } catch (err) {
      await c1.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      c1.release();
      c1 = null;
    }
  };

  // T2 — waits for T1 to hold the lock, then tries the same FOR UPDATE (blocks)
  const runT2 = async (): Promise<void> => {
    // Wait until T1 has the lock before connecting
    await t1HasLock.wait();

    c2 = await pool.connect();
    try {
      log("T2", "BEGIN", { sql: "BEGIN;", nivel: "info" });
      await c2.query("BEGIN");

      log("T2", `SELECT … FOR UPDATE en el MISMO asiento ${asientoNumero} — BLOQUEADA`, {
        sql: `SELECT id, estado FROM asientos WHERE id = ${asientoId} FOR UPDATE; -- bloqueada`,
        nivel: "lock",
      });

      const blockStart = Date.now();

      // This WILL block until T1 commits and releases the row lock
      await c2.query("SELECT id, estado FROM asientos WHERE id = $1 FOR UPDATE", [asientoId]);

      const waitMs = Date.now() - blockStart;
      log("T2", `Desbloqueada después de ${waitMs} ms — T1 ya hizo COMMIT`, {
        nivel: "lock",
      });

      // Re-read the current seat state (it is now 'ocupado')
      const stateRes = await c2.query<{ estado: string }>(
        "SELECT estado FROM asientos WHERE id = $1",
        [asientoId],
      );
      const estado = stateRes.rows[0]?.estado;

      if (estado === "ocupado") {
        log("T2", `Re-lectura: estado = '${estado}' — asiento ya tomado por T1`, {
          sql: `SELECT estado FROM asientos WHERE id = ${asientoId}; -- '${estado}'`,
          nivel: "error",
        });
        await c2.query("ROLLBACK");
        log("T2", "ROLLBACK — T2 no pudo reservar, integridad mantenida", {
          sql: "ROLLBACK;",
          nivel: "error",
        });
      } else {
        // Should not happen if T1 committed correctly, but handle gracefully
        await c2.query("ROLLBACK");
        log("T2", `ROLLBACK — estado inesperado: '${estado ?? "null"}'`, {
          nivel: "error",
        });
      }
    } catch (err) {
      await c2.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      c2.release();
      c2 = null;
    }
  };

  // Both transactions must fully complete before cleanup runs
  await Promise.all([runT1(), runT2()]);

  // ── Post-both cleanup — dedicated connection, own transaction ────────────────
  // Runs AFTER Promise.all resolves so T2 is guaranteed to be done.
  // Even if a cleanup statement throws, the finally block releases the client
  // and the catch ROLLBACK ensures no partial state is left committed.
  const cCleanup = await pool.connect();
  try {
    await cCleanup.query("BEGIN");
    if (reservaId !== null) {
      await cCleanup.query("DELETE FROM reservas WHERE id = $1", [reservaId]);
    }
    await cCleanup.query("DELETE FROM pasajeros WHERE documento LIKE 'PWLAB-%'");
    await cCleanup.query("UPDATE asientos SET estado = 'libre' WHERE id = $1", [asientoId]);
    await cCleanup.query("COMMIT");
    log("sistema", "Limpieza completada — asiento libre, reserva lab eliminada", {
      nivel: "info",
    });
  } catch (cleanupErr) {
    await cCleanup.query("ROLLBACK").catch(() => undefined);
    log("sistema", `Advertencia: limpieza falló — ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`, {
      nivel: "error",
    });
  } finally {
    cCleanup.release();
  }

  return {
    escenario: "doble-reserva",
    descripcion: "Doble reserva con pessimistic lock (SELECT FOR UPDATE)",
    eventos,
    conclusion:
      "SELECT … FOR UPDATE serializa el acceso al asiento. T2 bloqueó hasta que T1 " +
      "comiteó; al desbloquearse, leyó estado = 'ocupado' y hizo ROLLBACK. El asiento " +
      "se vendió exactamente una vez. Lección: el lock pesimista + el índice único sobre " +
      "(vuelo_id, asiento_id) actúan como dos capas de seguridad.",
  };
}

// ── Scenario 2: Niveles de aislamiento (non-repeatable read) ─────────────────

/**
 * Demonstrates non-repeatable read under READ COMMITTED vs REPEATABLE READ.
 * T1 reads the seat estado twice. T2 changes it between those reads.
 * Under READ COMMITTED, T1 sees the new value (anomaly visible).
 * Under REPEATABLE READ, T1 sees the original value both times (snapshot).
 *
 * Cleanup: T2's committed UPDATE is reverted by a cleanup connection.
 * T1 always ROLLBACKs, so no data from T1 persists.
 */
export async function escenarioAislamiento(): Promise<ResultadoLab> {
  const pool = getLabPool();
  const eventos: EventoLab[] = [];
  const start = Date.now();

  function log(
    actor: EventoLab["actor"],
    mensaje: string,
    opts?: { sql?: string; nivel?: EventoLab["nivel"] },
  ): void {
    eventos.push({ t: Date.now() - start, actor, mensaje, ...opts });
  }

  // Pick any seat (estado doesn't matter — we'll toggle it temporarily)
  const scout = await pool.connect();
  let asientoId: number;
  let asientoNumero: string;
  let estadoOriginal: string;
  try {
    const res = await scout.query<{ id: number; numero: string; estado: string }>(
      `SELECT id, numero, estado FROM asientos ORDER BY id ASC LIMIT 1`,
    );
    const row = res.rows[0];
    if (!row) throw new Error("No seats found in the database");
    asientoId = row.id;
    asientoNumero = row.numero;
    estadoOriginal = row.estado;
    log("sistema", `Asiento para demostración: ${asientoNumero} (id=${asientoId}, estado inicial='${estadoOriginal}')`, {
      nivel: "info",
    });
  } finally {
    scout.release();
  }

  // Closed set of allowed isolation levels — runtime backstop against injection
  // (the TypeScript type already constrains this, but the level cannot be a bound
  // parameter in a BEGIN statement, so we validate it explicitly here)
  const NIVELES_VALIDOS = new Set(["READ COMMITTED", "REPEATABLE READ"]);

  // Helper that runs one full READ COMMITTED or REPEATABLE READ cycle
  async function runCycle(level: "READ COMMITTED" | "REPEATABLE READ"): Promise<void> {
    if (!NIVELES_VALIDOS.has(level)) {
      throw new Error(`Invalid isolation level: "${level}". Allowed: READ COMMITTED, REPEATABLE READ`);
    }

    log("sistema", `── Ciclo con ${level} ──`, { nivel: "info" });

    const t1Ready = new Signal();
    const t2Done = new Signal();

    let c1: PoolClient | null = null;
    let c2: PoolClient | null = null;

    const runT1 = async (): Promise<void> => {
      c1 = await pool.connect();
      try {
        await c1.query(`BEGIN ISOLATION LEVEL ${level}`);
        log("T1", `BEGIN ISOLATION LEVEL ${level}`, {
          sql: `BEGIN ISOLATION LEVEL ${level};`,
          nivel: "info",
        });

        const r1 = await c1.query<{ estado: string }>(
          "SELECT estado FROM asientos WHERE id = $1",
          [asientoId],
        );
        const primera = r1.rows[0]?.estado ?? "?";
        log("T1", `1ª lectura: estado = '${primera}'`, {
          sql: `SELECT estado FROM asientos WHERE id = ${asientoId}; -- '${primera}'`,
          nivel: "ok",
        });

        // Signal T2 to run its UPDATE, then wait for it to commit
        t1Ready.fire();
        await t2Done.wait();

        // Second read — may or may not see T2's change depending on isolation level
        const r2 = await c1.query<{ estado: string }>(
          "SELECT estado FROM asientos WHERE id = $1",
          [asientoId],
        );
        const segunda = r2.rows[0]?.estado ?? "?";

        if (level === "READ COMMITTED") {
          log(
            "T1",
            `2ª lectura: estado = '${segunda}' ← CAMBIÓ (lectura no repetible bajo READ COMMITTED)`,
            {
              sql: `SELECT estado FROM asientos WHERE id = ${asientoId}; -- '${segunda}'`,
              nivel: primera !== segunda ? "error" : "ok",
            },
          );
        } else {
          log(
            "T1",
            `2ª lectura: estado = '${segunda}' ← IGUAL que antes (snapshot de REPEATABLE READ)`,
            {
              sql: `SELECT estado FROM asientos WHERE id = ${asientoId}; -- '${segunda}'`,
              nivel: primera === segunda ? "ok" : "error",
            },
          );
        }

        await c1.query("ROLLBACK");
        log("T1", "ROLLBACK — T1 no modifica nada", { sql: "ROLLBACK;", nivel: "info" });
      } finally {
        c1.release();
        c1 = null;
      }
    };

    const estadoAlterno = estadoOriginal === "libre" ? "ocupado" : "libre";

    const runT2 = async (): Promise<void> => {
      await t1Ready.wait(); // wait until T1 has done its first read

      c2 = await pool.connect();
      try {
        await c2.query("BEGIN");
        log("T2", "BEGIN (READ COMMITTED por defecto)", { sql: "BEGIN;", nivel: "info" });

        log("T2", `UPDATE asiento a '${estadoAlterno}' — T1 aún está activa`, {
          sql: `UPDATE asientos SET estado = '${estadoAlterno}' WHERE id = ${asientoId};`,
          nivel: "info",
        });
        await c2.query("UPDATE asientos SET estado = $1 WHERE id = $2", [
          estadoAlterno,
          asientoId,
        ]);

        await c2.query("COMMIT");
        log("T2", `COMMIT — estado ahora es '${estadoAlterno}' en la DB`, {
          sql: "COMMIT;",
          nivel: "ok",
        });
        t2Done.fire();
      } catch (err) {
        await c2.query("ROLLBACK").catch(() => undefined);
        t2Done.fire();
        throw err;
      } finally {
        c2.release();
        c2 = null;
      }
    };

    await Promise.all([runT1(), runT2()]);
  }

  // Run READ COMMITTED cycle first
  await runCycle("READ COMMITTED");
  await delay(300);

  // Restore original state before REPEATABLE READ cycle
  const restoreConn = await pool.connect();
  try {
    await restoreConn.query("UPDATE asientos SET estado = $1 WHERE id = $2", [
      estadoOriginal,
      asientoId,
    ]);
    log("sistema", `Estado restaurado a '${estadoOriginal}' antes del ciclo REPEATABLE READ`, {
      nivel: "info",
    });
  } finally {
    restoreConn.release();
  }

  await delay(200);

  // Run REPEATABLE READ cycle
  await runCycle("REPEATABLE READ");

  // Final cleanup — restore original state
  const cleanupConn = await pool.connect();
  try {
    await cleanupConn.query("UPDATE asientos SET estado = $1 WHERE id = $2", [
      estadoOriginal,
      asientoId,
    ]);
    log("sistema", `Limpieza final: estado devuelto a '${estadoOriginal}'`, { nivel: "info" });
  } finally {
    cleanupConn.release();
  }

  return {
    escenario: "aislamiento",
    descripcion: "Niveles de aislamiento: lectura no repetible bajo READ COMMITTED vs REPEATABLE READ",
    eventos,
    conclusion:
      "Bajo READ COMMITTED, T1 vio el cambio de T2 en su segunda lectura — la 'lectura no " +
      "repetible' es una anomalía visible. Bajo REPEATABLE READ, T1 mantuvo su snapshot del " +
      "inicio de la transacción y no vio el cambio de T2, aunque T2 ya había comiteado. " +
      "Elegir el nivel correcto depende del contrato de consistencia que requiera la operación.",
  };
}

// ── Scenario 3: Deadlock ──────────────────────────────────────────────────────

/**
 * T1 locks seat S1 then tries to lock S2.
 * T2 locks seat S2 then tries to lock S1.
 * PostgreSQL detects the cycle and aborts one transaction (SQLSTATE 40P01).
 *
 * Cleanup: both transactions ROLLBACK (one explicitly, one by PostgreSQL),
 * so no committed changes are made.
 */
export async function escenarioDeadlock(): Promise<ResultadoLab> {
  const pool = getLabPool();
  const eventos: EventoLab[] = [];
  const start = Date.now();

  function log(
    actor: EventoLab["actor"],
    mensaje: string,
    opts?: { sql?: string; nivel?: EventoLab["nivel"] },
  ): void {
    eventos.push({ t: Date.now() - start, actor, mensaje, ...opts });
  }

  // Pick two seats that belong to the same flight
  const scout = await pool.connect();
  let s1Id: number;
  let s1Num: string;
  let s2Id: number;
  let s2Num: string;
  try {
    const res = await scout.query<{ id: number; numero: string }>(
      `SELECT a.id, a.numero
         FROM asientos a
        WHERE a.vuelo_id = (
          SELECT vuelo_id FROM asientos GROUP BY vuelo_id ORDER BY COUNT(*) DESC LIMIT 1
        )
        ORDER BY a.id ASC
        LIMIT 2`,
    );
    if (res.rows.length < 2) throw new Error("Not enough seats for deadlock demo");
    const r1 = res.rows[0];
    const r2 = res.rows[1];
    if (!r1 || !r2) throw new Error("Not enough seats for deadlock demo");
    s1Id = r1.id;
    s1Num = r1.numero;
    s2Id = r2.id;
    s2Num = r2.numero;
    log("sistema", `S1=${s1Num} (id=${s1Id}), S2=${s2Num} (id=${s2Id})`, { nivel: "info" });
    log("sistema", "T1 intentará: S1 → S2. T2 intentará: S2 → S1. Esto crea un ciclo.", {
      nivel: "info",
    });
  } finally {
    scout.release();
  }

  // Signals to interleave the two clients deterministically
  const t1HasS1 = new Signal();
  const t2HasS2 = new Signal();

  let deadlockVictim: "T1" | "T2" | null = null;
  let victimError: string = "";

  let c1: PoolClient | null = null;
  let c2: PoolClient | null = null;

  const runT1 = async (): Promise<void> => {
    c1 = await pool.connect();
    try {
      await c1.query("BEGIN");
      log("T1", "BEGIN", { sql: "BEGIN;", nivel: "info" });

      // Lock S1
      log("T1", `SELECT … FOR UPDATE en S1 (${s1Num})`, {
        sql: `SELECT id FROM asientos WHERE id = ${s1Id} FOR UPDATE; -- T1 toma S1`,
        nivel: "info",
      });
      await c1.query("SELECT id FROM asientos WHERE id = $1 FOR UPDATE", [s1Id]);
      log("T1", `S1 (${s1Num}) bloqueado por T1`, { nivel: "ok" });

      // Signal T2 it can start — and wait until T2 has locked S2
      t1HasS1.fire();
      await t2HasS2.wait();

      // Now try to lock S2 — T2 already holds it → cycle → deadlock
      log("T1", `Intentando SELECT … FOR UPDATE en S2 (${s2Num}) — T2 ya lo tiene…`, {
        sql: `SELECT id FROM asientos WHERE id = ${s2Id} FOR UPDATE; -- esperando S2`,
        nivel: "lock",
      });

      try {
        await c1.query("SELECT id FROM asientos WHERE id = $1 FOR UPDATE", [s2Id]);
        // If we get here (T1 was not the victim), commit cleanly
        await c1.query("ROLLBACK");
        log("T1", "ROLLBACK — T1 sobrevivió al deadlock (no fue la víctima)", {
          sql: "ROLLBACK;",
          nivel: "ok",
        });
      } catch (err) {
        if (isPgError(err) && err.code === "40P01") {
          deadlockVictim = "T1";
          victimError = err.message;
          log("T1", `ABORTADA por PostgreSQL (40P01 — deadlock detected): ${err.message}`, {
            sql: "-- ERROR 40P01: deadlock detected",
            nivel: "error",
          });
          await c1.query("ROLLBACK").catch(() => undefined);
          log("T1", "ROLLBACK automático — transacción víctima", {
            sql: "ROLLBACK; -- víctima del deadlock",
            nivel: "error",
          });
        } else {
          throw err;
        }
      }
    } catch (err) {
      if (isPgError(err) && err.code === "40P01") {
        deadlockVictim = "T1";
        victimError = err.message;
        log("T1", `ABORTADA (40P01): ${err.message}`, { nivel: "error" });
        await c1.query("ROLLBACK").catch(() => undefined);
      } else {
        await c1.query("ROLLBACK").catch(() => undefined);
        throw err;
      }
    } finally {
      c1.release();
      c1 = null;
    }
  };

  const runT2 = async (): Promise<void> => {
    // Wait until T1 has S1 before starting
    await t1HasS1.wait();

    c2 = await pool.connect();
    try {
      await c2.query("BEGIN");
      log("T2", "BEGIN", { sql: "BEGIN;", nivel: "info" });

      // Lock S2
      log("T2", `SELECT … FOR UPDATE en S2 (${s2Num})`, {
        sql: `SELECT id FROM asientos WHERE id = ${s2Id} FOR UPDATE; -- T2 toma S2`,
        nivel: "info",
      });
      await c2.query("SELECT id FROM asientos WHERE id = $1 FOR UPDATE", [s2Id]);
      log("T2", `S2 (${s2Num}) bloqueado por T2`, { nivel: "ok" });

      // Signal T1 it can attempt S2 now
      t2HasS2.fire();

      // Give T1 a moment to actually try to lock S2, then T2 tries S1
      await delay(100);

      log("T2", `Intentando SELECT … FOR UPDATE en S1 (${s1Num}) — T1 ya lo tiene…`, {
        sql: `SELECT id FROM asientos WHERE id = ${s1Id} FOR UPDATE; -- esperando S1`,
        nivel: "lock",
      });

      try {
        await c2.query("SELECT id FROM asientos WHERE id = $1 FOR UPDATE", [s1Id]);
        await c2.query("ROLLBACK");
        log("T2", "ROLLBACK — T2 sobrevivió (no fue la víctima)", {
          sql: "ROLLBACK;",
          nivel: "ok",
        });
      } catch (err) {
        if (isPgError(err) && err.code === "40P01") {
          deadlockVictim = "T2";
          victimError = err.message;
          log("T2", `ABORTADA por PostgreSQL (40P01 — deadlock detected): ${err.message}`, {
            sql: "-- ERROR 40P01: deadlock detected",
            nivel: "error",
          });
          await c2.query("ROLLBACK").catch(() => undefined);
          log("T2", "ROLLBACK automático — transacción víctima", {
            sql: "ROLLBACK; -- víctima del deadlock",
            nivel: "error",
          });
        } else {
          throw err;
        }
      }
    } catch (err) {
      if (isPgError(err) && err.code === "40P01") {
        deadlockVictim = "T2";
        victimError = err.message;
        log("T2", `ABORTADA (40P01): ${err.message}`, { nivel: "error" });
        await c2.query("ROLLBACK").catch(() => undefined);
      } else {
        await c2.query("ROLLBACK").catch(() => undefined);
        throw err;
      }
    } finally {
      c2.release();
      c2 = null;
    }
  };

  await Promise.all([runT1(), runT2()]);

  if (deadlockVictim) {
    log(
      "sistema",
      `PostgreSQL eligió a ${deadlockVictim} como víctima del deadlock. Ambas transacciones terminaron con ROLLBACK. Ningún dato fue modificado.`,
      { nivel: "ok" },
    );
  } else {
    log("sistema", "Deadlock no detectado — posible race condition en el timing", {
      nivel: "error",
    });
  }

  const victim = deadlockVictim ?? "ninguna (timing issue)";

  return {
    escenario: "deadlock",
    descripcion: "Deadlock real: T1 bloquea S1→S2, T2 bloquea S2→S1, creando un ciclo detectado por PostgreSQL",
    eventos,
    conclusion:
      `PostgreSQL detectó el ciclo de dependencias y abortó a ${victim} con SQLSTATE 40P01. ` +
      `El mensaje fue: "${victimError || "N/A"}". ` +
      "Ambas transacciones terminaron en ROLLBACK — ningún dato quedó modificado. " +
      "La solución en producción es SIEMPRE adquirir locks en el mismo orden canónico " +
      "(p. ej. ORDER BY id ASC) para romper el ciclo antes de que ocurra.",
  };
}
