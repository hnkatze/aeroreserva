/**
 * seed-ruido.mjs — datos de ruido realistas para demo
 *
 * Genera:
 *   1. Estados variados en ~420 vuelos (retrasado, abordando, despegado,
 *      aterrizado, cancelado). El resto queda como 'programado'.
 *   2. Ocupación variada en ~70 vuelos: reservas confirmadas con pasajeros
 *      de ruido (documento RUIDO-<n>). Apunta a ~4500-5500 reservas totales.
 *
 * Ejecutar:
 *   node --env-file=.env.local db/seed-ruido.mjs
 *
 * Marcadores de ruido: documentos 'RUIDO-<n>' → fácil filtrado o limpieza
 * futura sin tocar datos reales. NO se borran (son los datos de demo).
 */

import { Pool } from "pg";

const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:uTMlhtkybZsGgyVWhnlktZVAKoDnTWwN@acela.proxy.rlwy.net:49750/railway";

const pool = new Pool({ connectionString: DB_URL });

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
// PASO 1: Estados de vuelo
// ---------------------------------------------------------------------------

async function aplicarEstadosVuelo(client) {
  console.log("\n--- PASO 1: Aplicar estados de vuelo ---");

  // Obtener todos los ids de vuelos
  const { rows: vuelos } = await client.query(
    "SELECT id FROM vuelos ORDER BY id",
  );
  const ids = vuelos.map((r) => r.id);

  if (ids.length === 0) {
    console.log("  No hay vuelos en la base. Saltando.");
    return;
  }

  // Distribución objetivo (suma ~420 vuelos afectados):
  //   retrasado  : ~150  (con retraso_min aleatorio 15..180)
  //   abordando  : ~80
  //   despegado  : ~80
  //   aterrizado : ~80
  //   cancelado  : ~30
  //   programado : el resto (default, no requiere UPDATE)

  const pool1 = sample(ids, 150); // retrasado
  const remaining1 = ids.filter((id) => !pool1.includes(id));
  const pool2 = sample(remaining1, 80); // abordando
  const remaining2 = remaining1.filter((id) => !pool2.includes(id));
  const pool3 = sample(remaining2, 80); // despegado
  const remaining3 = remaining2.filter((id) => !pool3.includes(id));
  const pool4 = sample(remaining3, 80); // aterrizado
  const remaining4 = remaining3.filter((id) => !pool4.includes(id));
  const pool5 = sample(remaining4, 30); // cancelado

  // retrasado: UPDATE individual para fijar retraso_min aleatorio
  // Hacemos en lote de VALUES para eficiencia
  if (pool1.length > 0) {
    // Construir cláusula CASE para retraso_min
    const caseRetraso = pool1
      .map((id) => `WHEN id = ${id} THEN ${randInt(15, 180)}`)
      .join(" ");
    await client.query(`
      UPDATE vuelos
         SET estado = 'retrasado',
             retraso_min = CASE ${caseRetraso} END
       WHERE id = ANY($1)
    `, [pool1]);
    console.log(`  retrasado  : ${pool1.length} vuelos`);
  }

  // abordando, despegado, aterrizado, cancelado: UPDATE en lote por estado
  const estadoSimples = [
    ["abordando", pool2],
    ["despegado", pool3],
    ["aterrizado", pool4],
    ["cancelado", pool5],
  ];

  for (const [estado, lote] of estadoSimples) {
    if (lote.length > 0) {
      await client.query(
        `UPDATE vuelos SET estado = $1 WHERE id = ANY($2)`,
        [estado, lote],
      );
      console.log(`  ${estado.padEnd(10)}: ${lote.length} vuelos`);
    }
  }

  // Verificar distribución final
  const { rows: dist } = await client.query(
    `SELECT estado, count(*)::int AS n FROM vuelos GROUP BY estado ORDER BY n DESC`,
  );
  console.log("\n  Distribución final de estados:");
  for (const row of dist) {
    console.log(`    ${row.estado.padEnd(12)}: ${row.n}`);
  }
}

// ---------------------------------------------------------------------------
// PASO 2: Ocupación variada — pasajeros + reservas + asientos
// ---------------------------------------------------------------------------

async function generarOcupacion(client) {
  console.log("\n--- PASO 2: Generar ocupación variada ---");

  // Elegir ~70 vuelos que NO estén cancelados (no tiene sentido reservar en cancelado)
  const { rows: vuelosNoCancelados } = await client.query(
    `SELECT id FROM vuelos WHERE estado != 'cancelado' ORDER BY id`,
  );
  if (vuelosNoCancelados.length === 0) {
    console.log("  No hay vuelos disponibles. Saltando.");
    return;
  }

  const vuelos70 = sample(
    vuelosNoCancelados.map((r) => r.id),
    Math.min(70, vuelosNoCancelados.length),
  );

  console.log(`  Vuelos seleccionados para ocupación: ${vuelos70.length}`);

  // Para cada vuelo, obtener sus asientos libres
  // Procesamos de a 10 vuelos para no saturar Railway con queries largas
  let totalReservas = 0;
  let pasajeroCounter = 1; // contador global para doc RUIDO-N

  // Distribución de llenado deseada (mezcla realista):
  //   ~20% de vuelos al 85-95% (casi llenos)
  //   ~30% de vuelos al 40-60% (moderados)
  //   ~30% de vuelos al 15-30% (bajos)
  //   ~20% de vuelos al  5-12% (casi vacíos)

  function porcentajeLlenado(idx, total) {
    const q = idx / total;
    if (q < 0.2) return randInt(85, 95) / 100;
    if (q < 0.5) return randInt(40, 60) / 100;
    if (q < 0.8) return randInt(15, 30) / 100;
    return randInt(5, 12) / 100;
  }

  for (let i = 0; i < vuelos70.length; i++) {
    const vueloId = vuelos70[i];
    const pct = porcentajeLlenado(i, vuelos70.length);

    // Obtener asientos libres del vuelo
    const { rows: asientos } = await client.query(
      `SELECT id FROM asientos WHERE vuelo_id = $1 AND estado = 'libre' ORDER BY id`,
      [vueloId],
    );

    if (asientos.length === 0) continue;

    const nReservas = Math.max(1, Math.round(asientos.length * pct));
    const asientosElegidos = sample(
      asientos.map((r) => r.id),
      Math.min(nReservas, asientos.length),
    );

    if (asientosElegidos.length === 0) continue;

    // Crear pasajeros de ruido en lote (un pasajero por asiento)
    // doc RUIDO-<n>, nombre genérico
    const pasajeroValues = asientosElegidos
      .map((_, j) => {
        const n = pasajeroCounter + j;
        return `('RUIDO-${n}', 'Pasajero Ruido ${n}')`;
      })
      .join(",\n      ");

    const { rows: pasajeros } = await client.query(`
      INSERT INTO pasajeros (documento, nombre)
      VALUES ${pasajeroValues}
      ON CONFLICT (documento) DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING id
    `);

    const pasajeroIds = pasajeros.map((r) => r.id);
    pasajeroCounter += asientosElegidos.length;

    // Crear reservas confirmadas en lote
    const reservaValues = asientosElegidos
      .map((asientoId, j) => {
        const pasajeroId = pasajeroIds[j];
        return `(${vueloId}, ${asientoId}, ${pasajeroId}, 1, 'confirmada')`;
      })
      .join(",\n      ");

    await client.query(`
      INSERT INTO reservas (vuelo_id, asiento_id, pasajero_id, operador_id, estado)
      VALUES ${reservaValues}
      ON CONFLICT DO NOTHING
    `);

    // Marcar asientos como ocupados en lote
    await client.query(
      `UPDATE asientos SET estado = 'ocupado' WHERE id = ANY($1)`,
      [asientosElegidos],
    );

    totalReservas += asientosElegidos.length;

    if ((i + 1) % 10 === 0) {
      console.log(
        `  Procesados ${i + 1}/${vuelos70.length} vuelos — ${totalReservas} reservas hasta ahora`,
      );
    }
  }

  console.log(`\n  Total reservas confirmadas creadas: ${totalReservas}`);
  return totalReservas;
}

// ---------------------------------------------------------------------------
// PASO 3: Verificación — muestra métricas finales
// ---------------------------------------------------------------------------

async function mostrarMetricas(client) {
  console.log("\n--- PASO 3: Métricas post-seed ---");

  // KPIs globales
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
      `    ${r.codigo.padEnd(10)} ${r.origen}->${r.destino}  ${r.ocupados}/${r.total_asientos} asientos  ${r.pct_ocupacion}%`,
    );
  }

  // Ocupación por aerolínea
  const { rows: aerol } = await client.query(`
    SELECT aerolinea_codigo, aerolinea_nombre, cantidad_vuelos,
           total_ocupados, total_asientos, pct_ocupacion_prom
      FROM v_ocupacion_aerolinea
     WHERE total_ocupados > 0
     ORDER BY pct_ocupacion_prom DESC
  `);
  console.log("\n  Ocupación por aerolínea (con datos):");
  for (const r of aerol) {
    console.log(
      `    ${(r.aerolinea_codigo ?? "??").padEnd(6)} ${(r.aerolinea_nombre ?? "Desconocida").padEnd(20)} vuelos: ${r.cantidad_vuelos}  ocu: ${r.total_ocupados}/${r.total_asientos}  ${r.pct_ocupacion_prom}%`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const client = await pool.connect();
try {
  await client.query("BEGIN");

  await aplicarEstadosVuelo(client);
  const totalReservas = await generarOcupacion(client);

  await client.query("COMMIT");

  console.log("\n✔ Seed de ruido aplicado correctamente.");
  console.log(`  Reservas confirmadas generadas: ${totalReservas ?? 0}`);

  await mostrarMetricas(client);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("\n✘ ERROR — ROLLBACK aplicado:");
  console.error(err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
