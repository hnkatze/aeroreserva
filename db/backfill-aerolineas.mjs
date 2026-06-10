// One-shot backfill: populates `aerolineas` from OpenFlights airlines.dat
// and updates vuelos.aerolinea_codigo for all rows.
//
// Usage:
//   node --env-file=.env.local db/backfill-aerolineas.mjs
//   DATABASE_URL="..." node db/backfill-aerolineas.mjs

import { createRequire } from "node:module";
import https from "node:https";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// HTTP fetch helper (follows one redirect, no extra deps)
// ---------------------------------------------------------------------------

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
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
// CSV parser — same logic as import-openflights.mjs
// Handles commas inside double-quoted fields, escaped quotes (""), \N → null.
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
        if (i < line.length && line[i] === ",") i++;
      } else {
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
// MAIN
// ---------------------------------------------------------------------------

const client = await pool.connect();

try {
  // -------------------------------------------------------------------------
  // Step 1: Download and parse airlines.dat
  // airlines.dat columns (0-based):
  //   0=AirlineID, 1=Name(q), 2=Alias(q), 3=IATA(q), 4=ICAO(q),
  //   5=Callsign(q), 6=Country(q), 7=Active(q)
  // IATA = 2 letters, ICAO = 3 letters. Nulos = \N.
  // -------------------------------------------------------------------------

  console.log("[airlines] Downloading airlines.dat from OpenFlights...");
  const raw = await fetchText(
    "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat"
  );
  const rows = parseCSV(raw);
  console.log(`[airlines] Parsed ${rows.length} rows`);

  // Build a Map: code → { nombre, pais }
  // Index by both ICAO (3 letters) and IATA (2 letters), skipping nulls.
  const airlineMap = new Map(); // code (string) → { nombre: string, pais: string|null }

  for (const row of rows) {
    const nombre = row[1]; // Name
    const iata   = row[3]; // 2-letter IATA
    const icao   = row[4]; // 3-letter ICAO
    const pais   = row[6]; // Country
    if (!nombre) continue;

    if (icao && /^[A-Z]{3}$/.test(icao)) {
      if (!airlineMap.has(icao)) {
        airlineMap.set(icao, { nombre, pais: pais ?? null });
      }
    }
    if (iata && /^[A-Z0-9]{2}$/.test(iata)) {
      if (!airlineMap.has(iata)) {
        airlineMap.set(iata, { nombre, pais: pais ?? null });
      }
    }
  }

  console.log(`[airlines] Map size: ${airlineMap.size} codes indexed`);

  // -------------------------------------------------------------------------
  // Step 2: Get DISTINCT airline prefixes actually present in vuelos
  // -------------------------------------------------------------------------

  console.log("[backfill] Querying distinct prefixes from vuelos...");
  const { rows: prefixRows } = await client.query(
    `SELECT DISTINCT regexp_replace(codigo, '[0-9]+$', '') AS cod FROM vuelos`
  );
  const prefixes = prefixRows.map((r) => r.cod).filter(Boolean);
  console.log(`[backfill] Found ${prefixes.length} distinct prefix(es): ${prefixes.join(", ")}`);

  // -------------------------------------------------------------------------
  // Step 3: Build aerolineas rows — real name if found, fallback to code
  // -------------------------------------------------------------------------

  const aerolineas = prefixes.map((cod) => {
    const match = airlineMap.get(cod);
    return {
      codigo: cod,
      nombre: match ? match.nombre : cod,
      pais:   match ? match.pais   : null,
    };
  });

  console.log("\n[backfill] Airline resolution:");
  for (const a of aerolineas) {
    const src = airlineMap.has(a.codigo) ? "OpenFlights" : "FALLBACK";
    console.log(`  ${a.codigo.padEnd(5)} → ${a.nombre} (${a.pais ?? "—"})  [${src}]`);
  }

  // -------------------------------------------------------------------------
  // Step 4: Upsert into aerolineas
  // -------------------------------------------------------------------------

  console.log("\n[backfill] Upserting into aerolineas...");
  for (const a of aerolineas) {
    await client.query(
      `INSERT INTO aerolineas (codigo, nombre, pais)
       VALUES ($1, $2, $3)
       ON CONFLICT (codigo) DO UPDATE
         SET nombre = EXCLUDED.nombre,
             pais   = EXCLUDED.pais`,
      [a.codigo, a.nombre, a.pais]
    );
  }
  console.log(`[backfill] Upserted ${aerolineas.length} row(s) into aerolineas`);

  // -------------------------------------------------------------------------
  // Step 5: Backfill vuelos.aerolinea_codigo
  // -------------------------------------------------------------------------

  console.log("[backfill] Updating vuelos.aerolinea_codigo...");
  const updateRes = await client.query(
    `UPDATE vuelos
        SET aerolinea_codigo = regexp_replace(codigo, '[0-9]+$', '')
      WHERE aerolinea_codigo IS NULL`
  );
  console.log(`[backfill] Updated ${updateRes.rowCount} vuelos rows`);

  // -------------------------------------------------------------------------
  // Step 6: Verification
  // -------------------------------------------------------------------------

  console.log("\n[verify] Final counts:");

  const { rows: verRows } = await client.query(`
    SELECT
      (SELECT count(*) FROM aerolineas)                        AS total_aerolineas,
      (SELECT count(*) FROM vuelos WHERE aerolinea_codigo IS NOT NULL) AS vuelos_con_aerolinea,
      (SELECT count(*) FROM vuelos)                            AS total_vuelos
  `);
  const v = verRows[0];
  console.log(`  aerolineas                  : ${v.total_aerolineas}`);
  console.log(`  vuelos con aerolinea_codigo : ${v.vuelos_con_aerolinea} / ${v.total_vuelos}`);

  const { rows: detailRows } = await client.query(
    `SELECT codigo, nombre, pais FROM aerolineas ORDER BY codigo`
  );
  console.log("\n[verify] aerolineas table:");
  for (const r of detailRows) {
    console.log(`  ${r.codigo.padEnd(5)} → ${r.nombre}  (${r.pais ?? "—"})`);
  }

} finally {
  client.release();
  await pool.end();
}
