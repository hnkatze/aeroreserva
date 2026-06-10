/**
 * seed-ruido.mjs — datos de ruido realistas para demo
 *
 * Genera:
 *   1. (si no existía) Estados variados en ~420 vuelos (retrasado, abordando,
 *      despegado, aterrizado, cancelado). El resto queda como 'programado'.
 *   2. Ocupación MASIVA variada: sube la ocupación global a ~25-30% de forma
 *      eficiente con bulk INSERT/UPDATE, deshabilitando triggers durante la
 *      carga y re-habilitándolos siempre en el finally.
 *
 * Técnica DBA de bulk load
 * ────────────────────────
 *  • ALTER TABLE … DISABLE TRIGGER USER al inicio de la carga pesada.
 *    Esto evita que los triggers de auditoría (007) y promoción (008) se
 *    disparen por cada fila, lo cual destruiría la bitácora y haría la carga
 *    10-50x más lenta.
 *  • ALWAYS en el finally: ALTER TABLE … ENABLE TRIGGER USER.
 *    No importa si la carga falla — los triggers SIEMPRE quedan activos.
 *  • Pasajeros de ruido: multi-row INSERT de ~5.000 filas en lotes.
 *    ON CONFLICT DO NOTHING para idempotencia.
 *  • Reservas: INSERT INTO reservas … SELECT server-side.
 *    Se usa (a.id % 10) < k para cada vuelo en un único statement por grupo,
 *    evitando round-trips. Mucho más rápido que construir VALUES en Node.
 *  • Asientos: un solo UPDATE masivo al final:
 *      UPDATE asientos SET estado = 'ocupado'
 *      WHERE id IN (SELECT asiento_id FROM reservas WHERE estado = 'confirmada')
 *    … con LIMIT implícito en los asientos recién insertados.
 *
 * Ejecutar:
 *   node --env-file=.env.local db/seed-ruido.mjs
 *   # o con inline credentials:
 *   DATABASE_URL="postgresql://…" node db/seed-ruido.mjs
 *
 * Marcadores de ruido: documentos 'RUIDO-<n>' → fácil filtrado o limpieza
 * futura sin tocar datos reales. NO se borran; son los datos de demo.
 */

import { Pool } from "pg";

const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:uTMlhtkybZsGgyVWhnlktZVAKoDnTWwN@acela.proxy.rlwy.net:49750/railway";

const pool = new Pool({ connectionString: DB_URL, max: 3 });

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Elegir n elementos aleatorios de un array (sin repetición). */
function sample(arr, n) {
  const copy = [...arr];
  const result = [];
  while (result.length < n && copy.length > 0) {
    const idx = randInt(0, copy.length - 1);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// PASO 1: Estados de vuelo (idempotente — sólo aplica si ya no se hizo)
// ---------------------------------------------------------------------------

async function aplicarEstadosVuelo(client) {
  console.log("\n--- PASO 1: Aplicar estados de vuelo ---");

  const { rows: vuelos } = await client.query(
    "SELECT id FROM vuelos ORDER BY id",
  );
  const ids = vuelos.map((r) => r.id);

  if (ids.length === 0) {
    console.log("  No hay vuelos en la base. Saltando.");
    return;
  }

  const pool1 = sample(ids, 150); // retrasado
  const remaining1 = ids.filter((id) => !pool1.includes(id));
  const pool2 = sample(remaining1, 80); // abordando
  const remaining2 = remaining1.filter((id) => !pool2.includes(id));
  const pool3 = sample(remaining2, 80); // despegado
  const remaining3 = remaining2.filter((id) => !pool3.includes(id));
  const pool4 = sample(remaining3, 80); // aterrizado
  const remaining4 = remaining3.filter((id) => !pool4.includes(id));
  const pool5 = sample(remaining4, 30); // cancelado

  if (pool1.length > 0) {
    const caseRetraso = pool1
      .map((id) => `WHEN id = ${id} THEN ${randInt(15, 180)}`)
      .join(" ");
    await client.query(
      `UPDATE vuelos SET estado = 'retrasado', retraso_min = CASE ${caseRetraso} END WHERE id = ANY($1)`,
      [pool1],
    );
    console.log(`  retrasado  : ${pool1.length} vuelos`);
  }

  const estadoSimples = [
    ["abordando", pool2],
    ["despegado", pool3],
    ["aterrizado", pool4],
    ["cancelado", pool5],
  ];

  for (const [estado, lote] of estadoSimples) {
    if (lote.length > 0) {
      await client.query(`UPDATE vuelos SET estado = $1 WHERE id = ANY($2)`, [
        estado,
        lote,
      ]);
      console.log(`  ${estado.padEnd(10)}: ${lote.length} vuelos`);
    }
  }

  const { rows: dist } = await client.query(
    `SELECT estado, count(*)::int AS n FROM vuelos GROUP BY estado ORDER BY n DESC`,
  );
  console.log("\n  Distribución final de estados:");
  for (const row of dist) {
    console.log(`    ${row.estado.padEnd(12)}: ${row.n}`);
  }
}

// ---------------------------------------------------------------------------
// PASO 2: Bulk load de ocupación masiva (~25-30% global)
//
// Estrategia:
//   - Deshabilitamos triggers durante toda la carga.
//   - Creamos 5.000 pasajeros de ruido en lotes (ON CONFLICT DO NOTHING).
//   - Por grupos de vuelos con distintos k (0-9), hacemos un INSERT…SELECT
//     server-side para todos los vuelos del grupo a la vez:
//       INSERT INTO reservas (vuelo_id, asiento_id, pasajero_id, operador_id)
//       SELECT a.vuelo_id, a.id,
//              <pasajero_id aleatorio de la tabla temporal>,
//              1
//       FROM asientos a
//       WHERE a.estado = 'libre'
//         AND a.vuelo_id = ANY($vuelos_del_grupo)
//         AND (a.id % 10) < k
//   - Luego un único UPDATE asientos masivo.
//
// Distribución de ocupación por vuelo:
//   k=9 (90% de asientos) → vuelos "casi llenos"
//   k=7 (70%)             → vuelos con alta demanda
//   k=5 (50%)             → vuelos moderados
//   k=3 (30%)             → vuelos con baja ocupación
//   k=1 (10%)             → vuelos casi vacíos
//   k=0 → excluidos de la carga (vuelos que quedan vacíos)
// ---------------------------------------------------------------------------

async function generarOcupacionMasiva(client) {
  console.log("\n--- PASO 2: Generar ocupación masiva (bulk) ---");

  // ─── Métricas ANTES ──────────────────────────────────────────────────────
  const { rows: antesRows } = await client.query(`SELECT * FROM v_resumen_kpis`);
  const antes = antesRows[0];
  console.log(`\n  ANTES:`);
  console.log(`    asientos_ocupados    : ${antes.asientos_ocupados}`);
  console.log(`    pct_ocupacion_global : ${antes.pct_ocupacion_global}%`);
  console.log(`    reservas_confirmadas : ${antes.reservas_confirmadas}`);

  // ─── Obtener vuelos no cancelados ────────────────────────────────────────
  const { rows: vuelosRows } = await client.query(
    `SELECT id FROM vuelos WHERE estado != 'cancelado' ORDER BY random()`,
  );
  if (vuelosRows.length === 0) {
    console.log("  No hay vuelos disponibles. Saltando.");
    return;
  }
  const todosVuelos = vuelosRows.map((r) => r.id);

  // Queremos ocupar ~250.000-280.000 asientos de ~995.000 libres.
  // Con 6637 vuelos y ~150 asientos promedio:
  //   k=9 → ~90% de asientos por vuelo → seleccionamos ~15% de vuelos
  //   k=7 → ~70%                       → ~20% de vuelos
  //   k=5 → ~50%                       → ~20% de vuelos
  //   k=3 → ~30%                       → ~15% de vuelos
  //   k=1 → ~10%                       → ~10% de vuelos
  //   k=0 (vacíos) → ~20% restante
  //
  // Estimado: 0.15*6637 vuelos * 150 asientos * 0.9
  //         + 0.20*6637 * 150 * 0.7 + ... ≈ 270.000 asientos

  const n = todosVuelos.length;
  const cortes = [
    { k: 9, hasta: Math.floor(n * 0.15) },
    { k: 7, hasta: Math.floor(n * 0.35) },
    { k: 5, hasta: Math.floor(n * 0.55) },
    { k: 3, hasta: Math.floor(n * 0.70) },
    { k: 1, hasta: Math.floor(n * 0.80) },
    // 20% restante queda con k=0 (sin carga)
  ];

  // ─── Determinar el próximo N para pasajeros de ruido ─────────────────────
  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(max(replace(documento,'RUIDO-','')::int), 0) AS mx
       FROM pasajeros WHERE documento LIKE 'RUIDO-%'`,
  );
  let ruidoBase = Number(maxRows[0].mx); // próximo será ruidoBase+1

  // ─── Crear 5.000 pasajeros de ruido en lotes de 500 ─────────────────────
  console.log(`\n  Creando pasajeros de ruido (base RUIDO-${ruidoBase + 1})...`);
  const TOTAL_PAX = 5000;
  const CHUNK_PAX = 500;
  const pasajeroIds = []; // ids creados/existentes

  for (let offset = 0; offset < TOTAL_PAX; offset += CHUNK_PAX) {
    const values = [];
    for (let j = 0; j < CHUNK_PAX; j++) {
      const n = ruidoBase + offset + j + 1;
      values.push(`('RUIDO-${n}', 'Pasajero Ruido ${n}')`);
    }
    const { rows: inserted } = await client.query(`
      INSERT INTO pasajeros (documento, nombre)
      VALUES ${values.join(",")}
      ON CONFLICT (documento) DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING id
    `);
    pasajeroIds.push(...inserted.map((r) => r.id));
  }
  console.log(`  Pasajeros de ruido disponibles: ${pasajeroIds.length}`);

  // ─── Crear tabla temporal con los ids de pasajeros (con rn para lookup) ──
  // Indexamos por rn (0-based) para poder hacer pasajero_ids[asiento_id % N]
  // en el servidor sin ORDER BY random() por fila (que sería O(n*N)).
  await client.query(`
    CREATE TEMP TABLE tmp_pax_ruido (rn int PRIMARY KEY, id bigint NOT NULL)
    ON COMMIT DROP
  `);
  // Insertamos en lotes de 1000
  const PAX_CHUNK = 1000;
  for (let i = 0; i < pasajeroIds.length; i += PAX_CHUNK) {
    const lote = pasajeroIds.slice(i, i + PAX_CHUNK);
    const vals = lote.map((pid, j) => `(${i + j}, ${pid})`).join(",");
    await client.query(`INSERT INTO tmp_pax_ruido VALUES ${vals}`);
  }

  // ─── DESHABILITAR TRIGGERS (carga masiva) ────────────────────────────────
  // CRÍTICO: el finally de main() RE-HABILITA siempre, aunque falle aquí.
  await client.query("ALTER TABLE reservas DISABLE TRIGGER USER");
  await client.query("ALTER TABLE asientos DISABLE TRIGGER USER");
  await client.query("ALTER TABLE pasajeros DISABLE TRIGGER USER");
  console.log("\n  Triggers deshabilitados. Iniciando carga bulk...");

  // ─── INSERT…SELECT server-side por grupo de k ────────────────────────────
  let totalInsertadas = 0;
  let inicio = 0;

  for (const { k, hasta } of cortes) {
    if (k === 0) break;
    const grupoIds = todosVuelos.slice(inicio, hasta);
    inicio = hasta;

    if (grupoIds.length === 0) continue;

    // Un único INSERT…SELECT para todos los vuelos del grupo.
    // Asignamos pasajero mediante (a.id % N) como lookup en tmp_pax_ruido:
    // O(1) por fila, sin ORDER BY random() que sería O(n*N).
    const { rowCount } = await client.query(
      `
      INSERT INTO reservas (vuelo_id, asiento_id, pasajero_id, operador_id, estado)
      SELECT a.vuelo_id,
             a.id,
             p.id,
             1,
             'confirmada'
        FROM asientos a
        JOIN tmp_pax_ruido p ON p.rn = (a.id % $3)
       WHERE a.estado = 'libre'
         AND a.vuelo_id = ANY($1)
         AND (a.id % 10) < $2
      ON CONFLICT DO NOTHING
      `,
      [grupoIds, k, pasajeroIds.length],
    );

    totalInsertadas += rowCount ?? 0;
    console.log(
      `  k=${k} | ${grupoIds.length} vuelos | +${rowCount} reservas (acum: ${totalInsertadas})`,
    );
  }

  // ─── Marcar asientos como ocupados en un solo UPDATE masivo ──────────────
  console.log("\n  Actualizando estado de asientos (bulk UPDATE)...");
  const { rowCount: asientosActualizados } = await client.query(`
    UPDATE asientos a
       SET estado = 'ocupado'
      FROM reservas r
     WHERE r.asiento_id = a.id
       AND r.estado = 'confirmada'
       AND a.estado = 'libre'
  `);
  console.log(`  Asientos marcados como ocupados: ${asientosActualizados}`);

  // ─── RE-HABILITAR TRIGGERS (carga masiva terminada) ───────────────────────
  // Los re-habilitamos aquí para que mostrarMetricas() los vea activos.
  // El finally de main() los re-habilitará de nuevo si algo fallara después,
  // pero ENABLE en un trigger ya habilitado es un no-op seguro.
  await client.query("ALTER TABLE reservas ENABLE TRIGGER USER");
  await client.query("ALTER TABLE asientos ENABLE TRIGGER USER");
  await client.query("ALTER TABLE pasajeros ENABLE TRIGGER USER");
  console.log("  Triggers re-habilitados.");

  return { totalInsertadas, asientosActualizados };
}

// ---------------------------------------------------------------------------
// PASO 3: Verificación — muestra métricas finales
// ---------------------------------------------------------------------------

async function mostrarMetricas(client) {
  console.log("\n--- PASO 3: Métricas post-seed ---");

  const { rows: kpis } = await client.query(`SELECT * FROM v_resumen_kpis`);
  const k = kpis[0];
  console.log("\n  v_resumen_kpis:");
  console.log(`    total_vuelos         : ${k.total_vuelos}`);
  console.log(`    total_asientos       : ${k.total_asientos}`);
  console.log(`    asientos_ocupados    : ${k.asientos_ocupados}`);
  console.log(`    asientos_libres      : ${k.asientos_libres}`);
  console.log(`    pct_ocupacion_global : ${k.pct_ocupacion_global}%`);
  console.log(`    reservas_confirmadas : ${k.reservas_confirmadas}`);
  console.log(`    vuelos_llenos (>=90%): ${k.vuelos_llenos}`);
  console.log(`    aerolineas_activas   : ${k.aerolineas_activas}`);

  // Top 5 vuelos por ocupación
  const { rows: top5 } = await client.query(`
    SELECT codigo, origen, destino, aerolinea_codigo,
           total_asientos, ocupados, pct_ocupacion
      FROM v_ocupacion_vuelo
     WHERE ocupados > 0
     ORDER BY pct_ocupacion DESC, ocupados DESC
     LIMIT 5
  `);
  console.log("\n  Top 5 vuelos por ocupación:");
  for (const r of top5) {
    console.log(
      `    ${r.codigo.padEnd(10)} ${r.origen}->${r.destino}  ${r.ocupados}/${r.total_asientos}  ${r.pct_ocupacion}%`,
    );
  }

  // Bottom 5 vuelos con asientos ocupados (menor %)
  const { rows: bot5 } = await client.query(`
    SELECT codigo, origen, destino, aerolinea_codigo,
           total_asientos, ocupados, pct_ocupacion
      FROM v_ocupacion_vuelo
     WHERE ocupados > 0
     ORDER BY pct_ocupacion ASC, ocupados ASC
     LIMIT 5
  `);
  console.log("\n  Bottom 5 vuelos con ocupación mínima:");
  for (const r of bot5) {
    console.log(
      `    ${r.codigo.padEnd(10)} ${r.origen}->${r.destino}  ${r.ocupados}/${r.total_asientos}  ${r.pct_ocupacion}%`,
    );
  }

  // Distribución de ocupación por bucket
  const { rows: dist } = await client.query(`
    SELECT
      CASE
        WHEN pct_ocupacion = 0   THEN '0%'
        WHEN pct_ocupacion < 20  THEN '1-19%'
        WHEN pct_ocupacion < 40  THEN '20-39%'
        WHEN pct_ocupacion < 60  THEN '40-59%'
        WHEN pct_ocupacion < 80  THEN '60-79%'
        WHEN pct_ocupacion < 100 THEN '80-99%'
        ELSE '100%'
      END AS bucket,
      count(*)::int AS vuelos
    FROM v_ocupacion_vuelo
    GROUP BY 1
    ORDER BY min(pct_ocupacion)
  `);
  console.log("\n  Distribución de vuelos por bucket de ocupación:");
  for (const r of dist) {
    console.log(`    ${r.bucket.padEnd(8)}: ${r.vuelos} vuelos`);
  }

  // Verificar triggers re-habilitados
  const { rows: trigs } = await client.query(`
    SELECT tgname, tgenabled
    FROM pg_trigger t
    JOIN pg_class cl ON cl.oid = t.tgrelid
    WHERE NOT t.tgisinternal
      AND cl.relname IN ('reservas','asientos','pasajeros')
    ORDER BY cl.relname, tgname
  `);
  console.log("\n  Estado de triggers post-carga:");
  for (const t of trigs) {
    const estado = t.tgenabled === "O" ? "HABILITADO" : `DESHABILITADO (${t.tgenabled})`;
    console.log(`    ${t.tgname.padEnd(40)}: ${estado}`);
  }
  const todosHabilitados = trigs.every((t) => t.tgenabled === "O");
  console.log(
    `\n  Triggers re-habilitados correctamente: ${todosHabilitados ? "SI" : "ALERTA - REVISAR"}`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const client = await pool.connect();
// Flag para el finally: se activa justo antes del primer ALTER DISABLE.
// Así el finally sabe si debe intentar re-habilitar.
let triggersDeshabilitados = false;

try {
  // ── PASO 1: Estados de vuelo (dentro de txn propia) ─────────────────────
  await client.query("BEGIN");
  await aplicarEstadosVuelo(client);
  await client.query("COMMIT");

  // ── PASO 2: Carga masiva de ocupación ───────────────────────────────────
  // La carga masiva corre en una única txn:
  //   • La tabla temp ON COMMIT DROP vive dentro de la txn.
  //   • Los ALTER TABLE DISABLE/ENABLE TRIGGER son DDL en PG; funcionan
  //     dentro de txn y se revierten si la txn hace ROLLBACK.
  //   • ON CONFLICT DO NOTHING garantiza idempotencia si se re-corre.
  await client.query("BEGIN");
  // Señalamos ANTES del DISABLE para que el finally re-habilite si algo
  // falla incluso antes de que el ALTER llegue a ejecutarse.
  triggersDeshabilitados = true;
  const resultado = await generarOcupacionMasiva(client);
  await client.query("COMMIT");

  console.log("\n✔ Seed de ruido masivo aplicado correctamente.");
  if (resultado) {
    console.log(`  Reservas insertadas en esta corrida : ${resultado.totalInsertadas}`);
    console.log(`  Asientos marcados ocupados          : ${resultado.asientosActualizados}`);
  }

  // ── PASO 3: Métricas (fuera de txn) ─────────────────────────────────────
  await mostrarMetricas(client);
} catch (err) {
  try { await client.query("ROLLBACK"); } catch (_) { /* ya rollbackeado */ }
  console.error("\n✘ ERROR:");
  console.error(err.message);
  process.exit(1);
} finally {
  // ── CRÍTICO: RE-HABILITAR TRIGGERS SIEMPRE ──────────────────────────────
  // Aunque la carga haya fallado, los triggers deben quedar activos.
  // Usamos un try separado para cada tabla para no dejar ninguna sin re-habilitar.
  if (triggersDeshabilitados) {
    const tablas = ["reservas", "asientos", "pasajeros"];
    for (const tabla of tablas) {
      try {
        await client.query(`ALTER TABLE ${tabla} ENABLE TRIGGER USER`);
        console.log(`  Triggers re-habilitados en: ${tabla}`);
      } catch (e) {
        console.error(`  ERROR re-habilitando triggers en ${tabla}: ${e.message}`);
      }
    }
  }
  client.release();
  await pool.end();
}
