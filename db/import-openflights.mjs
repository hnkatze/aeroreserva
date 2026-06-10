// OpenFlights real-data catalog importer.
// Downloads airports and routes from the OpenFlights public dataset and
// populates aeropuertos, vuelos, and asientos with realistic data.
//
// Usage:
//   node --env-file=.env.local db/import-openflights.mjs [options]
//   DATABASE_URL="..." node db/import-openflights.mjs [options]
//
// Options:
//   --vuelos=N   number of flights to generate (default: 300)
//   --asientos=M seats per flight (default: 150)
//   --dias=D     future date range in days for departure times (default: 30)
//   --reset      truncate all catalog+reservation tables before import
//
// Scale to ~1 million seats:
//   node --env-file=.env.local db/import-openflights.mjs --reset --vuelos=6700 --asientos=150
//   (6700 × 150 = 1,005,000 seats; runtime ~8-15 min on Railway free tier)

import { createRequire } from "node:module";
import https from "node:https";

// pg is a CommonJS module; use createRequire to import it from ESM.
const require = createRequire(import.meta.url);
const { Pool } = require("pg");

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { vuelos: 300, asientos: 150, dias: 30, reset: false };
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--(\w+)(?:=(.+))?$/);
    if (!m) continue;
    const [, key, val] = m;
    if (key === "reset") { args.reset = true; continue; }
    const n = parseInt(val, 10);
    if (!isNaN(n) && key in args) args[key] = n;
  }
  return args;
}

const args = parseArgs(process.argv);
console.log("Options:", args);

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// HTTP fetch helper (returns full body as string, no deps beyond node:https)
// ---------------------------------------------------------------------------

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one redirect (GitHub raw sometimes 302s)
        fetchText(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// CSV parser
// Handles:  - commas inside double-quoted fields
//           - escaped double-quotes ("")
//           - \N and empty quoted strings ("") → null
// Returns an array of arrays of strings|null.
// ---------------------------------------------------------------------------

function parseCSV(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() === "") continue;
    const fields = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let val = "";
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') {
            val += '"';
            i += 2;
          } else if (line[i] === '"') {
            i++; // skip closing quote
            break;
          } else {
            val += line[i++];
          }
        }
        fields.push(val === "" || val === "\\N" ? null : val);
        // Skip trailing comma
        if (i < line.length && line[i] === ",") i++;
      } else {
        // Unquoted field
        const end = line.indexOf(",", i);
        const raw = end === -1 ? line.slice(i) : line.slice(i, end);
        fields.push(raw === "" || raw === "\\N" ? null : raw);
        i = end === -1 ? line.length : end + 1;
      }
    }
    rows.push(fields);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Haversine distance in km
// ---------------------------------------------------------------------------

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Flight duration in minutes based on great-circle distance
// Speed assumption: 800 km/h cruise + 30 min ground/taxi buffer, min 30 min.
// ---------------------------------------------------------------------------

function flightDurationMin(lat1, lon1, lat2, lon2) {
  const km = haversineKm(lat1, lon1, lat2, lon2);
  return Math.max(30, Math.round((km / 800) * 60) + 30);
}

// ---------------------------------------------------------------------------
// Seat class assignment:
//   Row 1      → primera
//   Rows 2–4   → ejecutiva
//   Rows 5+    → economica
// This gives roughly 6/M primera, 18/M ejecutiva, rest economica.
// ---------------------------------------------------------------------------

function seatClass(row) {
  if (row === 1) return "primera";
  if (row <= 4) return "ejecutiva";
  return "economica";
}

// ---------------------------------------------------------------------------
// Batch insert helpers
// ---------------------------------------------------------------------------

/** Inserts rows in chunks of `size` using multi-row VALUES.
 *  buildValues(row) → array of per-row values (will be $1, $2, … spread).
 *  columns: comma-separated column names string.
 *  conflictClause: e.g. "ON CONFLICT (codigo) DO NOTHING"
 *  Returns total rows inserted (via RETURNING id count if requested).
 */
async function batchInsert(client, table, columns, rows, buildValues, conflictClause, batchSize = 500) {
  let inserted = 0;
  for (let start = 0; start < rows.length; start += batchSize) {
    const chunk = rows.slice(start, start + batchSize);
    const colCount = buildValues(chunk[0]).length;
    const placeholders = chunk
      .map((_, ri) => `(${Array.from({ length: colCount }, (_, ci) => `$${ri * colCount + ci + 1}`).join(", ")})`)
      .join(", ");
    const values = chunk.flatMap((r) => buildValues(r));
    const sql = `INSERT INTO ${table} (${columns}) VALUES ${placeholders} ${conflictClause}`;
    const res = await client.query(sql, values);
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

const client = await pool.connect();

try {
  // -------------------------------------------------------------------------
  // Optional reset
  // -------------------------------------------------------------------------
  if (args.reset) {
    console.log("\n[reset] Truncating all catalog and reservation tables...");
    // Order: reservas → asientos → vuelos → pasajeros → aerolineas → aeropuertos
    // vuelos references aerolineas; CASCADE covers dependent rows automatically.
    await client.query(`
      TRUNCATE reservas, asientos, vuelos, pasajeros, aerolineas, aeropuertos
      RESTART IDENTITY CASCADE
    `);
    console.log("[reset] Done — all tables cleared.\n");
  }

  // -------------------------------------------------------------------------
  // Step 1a: Download and parse airlines.dat (needed before flights)
  // airlines.dat columns (0-based):
  //   0=AirlineID, 1=Name(q), 2=Alias(q), 3=IATA(q), 4=ICAO(q),
  //   5=Callsign(q), 6=Country(q), 7=Active(q)
  // -------------------------------------------------------------------------
  console.log("[airlines] Downloading airlines.dat...");
  const airlinesRaw = await fetchText(
    "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat"
  );
  const airlineCSVRows = parseCSV(airlinesRaw);
  console.log(`[airlines] Parsed ${airlineCSVRows.length} rows`);

  // Build a Map: code → { nombre, pais }
  // Index by both ICAO (3-letter) and IATA (2-letter), preferring ICAO on collision.
  const airlineMap = new Map(); // code → { nombre, pais }
  for (const row of airlineCSVRows) {
    const nombre = row[1];
    const iata   = row[3];
    const icao   = row[4];
    const pais   = row[6];
    if (!nombre) continue;
    if (icao && /^[A-Z]{3}$/.test(icao) && !airlineMap.has(icao)) {
      airlineMap.set(icao, { nombre, pais: pais ?? null });
    }
    if (iata && /^[A-Z0-9]{2}$/.test(iata) && !airlineMap.has(iata)) {
      airlineMap.set(iata, { nombre, pais: pais ?? null });
    }
  }
  console.log(`[airlines] Map size: ${airlineMap.size} codes indexed`);

  // -------------------------------------------------------------------------
  // Step 1b: Download and parse airports.dat
  // -------------------------------------------------------------------------
  console.log("[airports] Downloading airports.dat...");
  const airportRaw = await fetchText(
    "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat"
  );
  const airportRows = parseCSV(airportRaw);
  console.log(`[airports] Parsed ${airportRows.length} rows`);

  // Column indices (0-based):
  // 0=ID, 1=Name, 2=City, 3=Country, 4=IATA, 5=ICAO, 6=Lat, 7=Lon, 8=Alt,
  // 9=TZoffset, 10=DST, 11=TZname, 12=Type, 13=Source
  const IATA_RE = /^[A-Z]{3}$/;
  const airportMap = new Map(); // iata → { nombre, ciudad, pais, lat, lon }
  const validAirports = [];

  for (const row of airportRows) {
    const iata = row[4];
    if (!iata || !IATA_RE.test(iata)) continue;
    const nombre = row[1] ?? "Unknown";
    const ciudad = row[2] ?? "Unknown";
    const pais   = row[3] ?? "Unknown";
    const lat    = parseFloat(row[6]);
    const lon    = parseFloat(row[7]);
    if (isNaN(lat) || isNaN(lon)) continue;
    airportMap.set(iata, { nombre, ciudad, pais, lat, lon });
    validAirports.push({ iata, nombre, ciudad, pais });
  }

  console.log(`[airports] Valid IATA codes: ${airportMap.size}`);

  // -------------------------------------------------------------------------
  // Step 2: Insert airports in batches of 500
  // -------------------------------------------------------------------------
  console.log("[airports] Inserting into DB...");
  const airportsInserted = await batchInsert(
    client,
    "aeropuertos",
    "codigo, nombre, ciudad, pais",
    validAirports,
    (r) => [r.iata, r.nombre, r.ciudad, r.pais],
    "ON CONFLICT (codigo) DO NOTHING",
    500
  );
  console.log(`[airports] Inserted ${airportsInserted} new rows (of ${validAirports.length} valid)`);

  // -------------------------------------------------------------------------
  // Step 3: Download and parse routes.dat
  // -------------------------------------------------------------------------
  console.log("\n[routes] Downloading routes.dat...");
  const routesRaw = await fetchText(
    "https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat"
  );
  const routeRows = parseCSV(routesRaw);
  console.log(`[routes] Parsed ${routeRows.length} rows`);

  // Column indices:
  // 0=Airline IATA, 1=AirlineID, 2=SrcIATA, 3=SrcID, 4=DstIATA, 5=DstID,
  // 6=Codeshare, 7=Stops, 8=Equipment
  const candidateRoutes = [];
  // Accumulate airlines that appear in selected routes (for pre-insert)
  const usedAirlines = new Map(); // code → { nombre, pais }

  for (const row of routeRows) {
    const airline = row[0];
    const src     = row[2];
    const dst     = row[4];
    if (!airline || !src || !dst) continue;
    if (!IATA_RE.test(airline)) continue; // need a 2-3 char airline code ideally
    if (!IATA_RE.test(src) || !IATA_RE.test(dst)) continue;
    if (src === dst) continue;
    if (!airportMap.has(src) || !airportMap.has(dst)) continue;
    candidateRoutes.push({ airline, src, dst });
    if (!usedAirlines.has(airline)) {
      const match = airlineMap.get(airline);
      usedAirlines.set(airline, {
        nombre: match ? match.nombre : airline,
        pais:   match ? match.pais   : null,
      });
    }
  }
  console.log(`[routes] Valid candidate routes: ${candidateRoutes.length}`);

  if (candidateRoutes.length === 0) {
    throw new Error("No valid routes found — cannot generate flights.");
  }

  // -------------------------------------------------------------------------
  // Step 3b: Insert airlines that will be referenced by the generated flights
  // Must happen BEFORE flights to satisfy the FK constraint.
  // -------------------------------------------------------------------------
  console.log(`\n[airlines] Inserting ${usedAirlines.size} airline(s) into aerolineas...`);
  const airlineRows = Array.from(usedAirlines.entries()).map(([codigo, info]) => ({
    codigo,
    nombre: info.nombre,
    pais:   info.pais,
  }));
  await batchInsert(
    client,
    "aerolineas",
    "codigo, nombre, pais",
    airlineRows,
    (r) => [r.codigo, r.nombre, r.pais],
    "ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, pais = EXCLUDED.pais",
    500
  );
  console.log(`[airlines] Done.`);

  // -------------------------------------------------------------------------
  // Step 4: Generate flights
  // -------------------------------------------------------------------------
  console.log(`\n[flights] Generating ${args.vuelos} flights...`);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const usedCodes = new Set();

  // We may need to cycle through routes if vuelos > candidateRoutes.length
  const flights = [];
  let counter = 1;

  for (let i = 0; i < args.vuelos; i++) {
    const route = candidateRoutes[i % candidateRoutes.length];
    const srcInfo = airportMap.get(route.src);
    const dstInfo = airportMap.get(route.dst);

    // Departure: now + random offset within [0, dias) days, hour in [5, 23)
    const dayOffset = Math.floor(Math.random() * args.dias) * dayMs;
    const hourOffset = (5 + Math.floor(Math.random() * 18)) * 60 * 60 * 1000;
    const minuteOffset = Math.floor(Math.random() * 60) * 60 * 1000;
    const salida = new Date(now + dayOffset + hourOffset + minuteOffset);

    // Duration based on haversine; llegada = salida + duration
    const durationMin = flightDurationMin(srcInfo.lat, srcInfo.lon, dstInfo.lat, dstInfo.lon);
    const llegada = new Date(salida.getTime() + durationMin * 60 * 1000);

    // Unique flight code: AIRLINE + zero-padded counter (4 digits)
    let code;
    do {
      code = `${route.airline}${String(counter).padStart(4, "0")}`;
      counter++;
    } while (usedCodes.has(code));
    usedCodes.add(code);

    flights.push({
      codigo: code,
      origen: route.src,
      destino: route.dst,
      salida,
      llegada,
      aerolinea_codigo: route.airline,
    });
  }

  console.log(`[flights] Generated ${flights.length} flight records`);

  // Insert flights in batches of 500, collecting returned IDs
  console.log("[flights] Inserting into DB...");
  const flightIds = [];
  const flightBatchSize = 500;

  for (let start = 0; start < flights.length; start += flightBatchSize) {
    const chunk = flights.slice(start, start + flightBatchSize);
    const colCount = 6; // codigo, origen, destino, salida, llegada, aerolinea_codigo
    const placeholders = chunk
      .map((_, ri) =>
        `(${Array.from({ length: colCount }, (_, ci) => `$${ri * colCount + ci + 1}`).join(", ")})`
      )
      .join(", ");
    const values = chunk.flatMap((f) => [
      f.codigo,
      f.origen,
      f.destino,
      f.salida,
      f.llegada,
      f.aerolinea_codigo,
    ]);

    const res = await client.query(
      `INSERT INTO vuelos (codigo, origen, destino, salida, llegada, aerolinea_codigo)
       VALUES ${placeholders}
       ON CONFLICT (codigo) DO NOTHING
       RETURNING id`,
      values
    );
    for (const row of res.rows) {
      flightIds.push(row.id);
    }

    if ((start / flightBatchSize + 1) % 5 === 0 || start + flightBatchSize >= flights.length) {
      console.log(`[flights]  ${Math.min(start + flightBatchSize, flights.length)} / ${flights.length} inserted`);
    }
  }

  console.log(`[flights] DB rows created: ${flightIds.length}`);

  // -------------------------------------------------------------------------
  // Step 5: Generate and insert seats
  // -------------------------------------------------------------------------
  const totalSeats = flightIds.length * args.asientos;
  console.log(`\n[seats] Generating ${totalSeats} seats (${flightIds.length} flights × ${args.asientos} each)...`);

  const rowsPerFlight = Math.ceil(args.asientos / 6);
  const COLS = ["A", "B", "C", "D", "E", "F"];

  // Build seat rows for one flight and append to a running accumulator.
  // Flush to DB every ~1000 rows to keep memory reasonable.
  let seatBuffer = [];
  let seatsInserted = 0;
  const SEAT_BATCH = 1000;
  let batchCount = 0;

  async function flushSeats() {
    if (seatBuffer.length === 0) return;
    const colCount = 4; // vuelo_id, numero, clase, estado
    const placeholders = seatBuffer
      .map((_, ri) =>
        `(${Array.from({ length: colCount }, (_, ci) => `$${ri * colCount + ci + 1}`).join(", ")})`
      )
      .join(", ");
    const values = seatBuffer.flatMap((s) => [s.vuelo_id, s.numero, s.clase, s.estado]);
    const res = await client.query(
      `INSERT INTO asientos (vuelo_id, numero, clase, estado)
       VALUES ${placeholders}
       ON CONFLICT (vuelo_id, numero) DO NOTHING`,
      values
    );
    seatsInserted += res.rowCount ?? 0;
    batchCount++;
    if (batchCount % 10 === 0) {
      process.stdout.write(`[seats]  ${seatsInserted.toLocaleString()} / ${totalSeats.toLocaleString()} inserted\r`);
    }
    seatBuffer = [];
  }

  for (const vueloId of flightIds) {
    let seatCount = 0;
    for (let row = 1; row <= rowsPerFlight && seatCount < args.asientos; row++) {
      for (const col of COLS) {
        if (seatCount >= args.asientos) break;
        seatBuffer.push({
          vuelo_id: vueloId,
          numero: `${row}${col}`,
          clase: seatClass(row),
          estado: "libre",
        });
        seatCount++;
        if (seatBuffer.length >= SEAT_BATCH) {
          await flushSeats();
        }
      }
    }
  }
  await flushSeats(); // final flush

  process.stdout.write("\n");
  console.log(`[seats] Done. ${seatsInserted.toLocaleString()} rows inserted.`);

  // -------------------------------------------------------------------------
  // Step 6: Final count verification
  // -------------------------------------------------------------------------
  console.log("\n[summary] Counting rows...");
  const counts = await client.query(`
    SELECT
      (SELECT count(*) FROM aeropuertos) AS aeropuertos,
      (SELECT count(*) FROM vuelos)      AS vuelos,
      (SELECT count(*) FROM asientos)    AS asientos
  `);
  const c = counts.rows[0];
  console.log(`  aeropuertos : ${Number(c.aeropuertos).toLocaleString()}`);
  console.log(`  vuelos      : ${Number(c.vuelos).toLocaleString()}`);
  console.log(`  asientos    : ${Number(c.asientos).toLocaleString()}`);

  const flightsFor1M = Math.ceil(1_000_000 / args.asientos);
  console.log(`\n  To reach 1,000,000 seats at ${args.asientos} seats/flight:`);
  console.log(`    --vuelos=${flightsFor1M} --asientos=${args.asientos}`);
  console.log(`    Command: node --env-file=.env.local db/import-openflights.mjs --reset --vuelos=${flightsFor1M} --asientos=${args.asientos}`);

  // -------------------------------------------------------------------------
  // Step 7: Sample flights for human verification
  // -------------------------------------------------------------------------
  console.log("\n[sample] 5 random flights:");
  const sample = await client.query(`
    SELECT
      v.codigo,
      a1.ciudad AS desde,
      a1.pais   AS pais_origen,
      a2.ciudad AS hasta,
      a2.pais   AS pais_destino,
      v.salida  AT TIME ZONE 'UTC' AS salida_utc,
      v.llegada AT TIME ZONE 'UTC' AS llegada_utc,
      (EXTRACT(EPOCH FROM (v.llegada - v.salida)) / 60)::int AS duracion_min
    FROM vuelos v
    JOIN aeropuertos a1 ON a1.codigo = v.origen
    JOIN aeropuertos a2 ON a2.codigo = v.destino
    ORDER BY random()
    LIMIT 5
  `);
  for (const r of sample.rows) {
    console.log(
      `  ${r.codigo.padEnd(8)} ${r.desde} (${r.pais_origen}) → ${r.hasta} (${r.pais_destino})` +
      `  ${String(r.salida_utc).slice(0, 19)}  +${r.duracion_min}min`
    );
  }

} finally {
  client.release();
  await pool.end();
}
