// Catalog seed: airports, flights, seats, and optional sample reservations.
// Idempotent — safe to run multiple times; all inserts use ON CONFLICT DO NOTHING.
// Run with:  node --env-file=.env.local db/seed-catalog.mjs
//        or: DATABASE_URL="..." node db/seed-catalog.mjs

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// Airports (8 LATAM + transatlantic hubs)
// ---------------------------------------------------------------------------
const AIRPORTS = [
  { codigo: "EZE", nombre: "Aeropuerto Internacional Ministro Pistarini", ciudad: "Buenos Aires", pais: "Argentina" },
  { codigo: "SCL", nombre: "Aeropuerto Internacional Arturo Merino Benítez", ciudad: "Santiago", pais: "Chile" },
  { codigo: "GRU", nombre: "Aeropuerto Internacional de São Paulo-Guarulhos", ciudad: "São Paulo", pais: "Brasil" },
  { codigo: "LIM", nombre: "Aeropuerto Internacional Jorge Chávez", ciudad: "Lima", pais: "Perú" },
  { codigo: "BOG", nombre: "Aeropuerto Internacional El Dorado", ciudad: "Bogotá", pais: "Colombia" },
  { codigo: "MVD", nombre: "Aeropuerto Internacional de Carrasco", ciudad: "Montevideo", pais: "Uruguay" },
  { codigo: "MIA", nombre: "Aeropuerto Internacional de Miami", ciudad: "Miami", pais: "Estados Unidos" },
  { codigo: "MAD", nombre: "Aeropuerto Adolfo Suárez Madrid-Barajas", ciudad: "Madrid", pais: "España" },
];

// ---------------------------------------------------------------------------
// Flights (~5 routes)
// ---------------------------------------------------------------------------
const now = new Date();

function addHours(date, h) {
  return new Date(date.getTime() + h * 60 * 60 * 1000);
}

const BASE = new Date(Date.UTC(2026, 6, 15, 10, 0, 0)); // 2026-07-15 10:00 UTC

const FLIGHTS = [
  { codigo: "AR1001", origen: "EZE", destino: "SCL", salida: new Date(Date.UTC(2026, 6, 15, 10, 0, 0)), llegada: new Date(Date.UTC(2026, 6, 15, 13, 0, 0)) },
  { codigo: "LA2002", origen: "SCL", destino: "LIM", salida: new Date(Date.UTC(2026, 6, 16, 8, 30, 0)), llegada: new Date(Date.UTC(2026, 6, 16, 11, 45, 0)) },
  { codigo: "AV3003", origen: "BOG", destino: "MIA", salida: new Date(Date.UTC(2026, 6, 17, 14, 0, 0)), llegada: new Date(Date.UTC(2026, 6, 17, 18, 30, 0)) },
  { codigo: "IB4004", origen: "MAD", destino: "EZE", salida: new Date(Date.UTC(2026, 6, 18, 22, 0, 0)), llegada: new Date(Date.UTC(2026, 6, 19, 7, 0, 0)) },
  { codigo: "GL5005", origen: "GRU", destino: "MVD", salida: new Date(Date.UTC(2026, 6, 20, 6, 0, 0)), llegada: new Date(Date.UTC(2026, 6, 20, 8, 30, 0)) },
];

// ---------------------------------------------------------------------------
// Seat generator: rows 1-20 × columns A-F
// Rows 1-4 = ejecutiva, rows 5-20 = economica
// ---------------------------------------------------------------------------
function buildSeats(vueloId) {
  const seats = [];
  for (let row = 1; row <= 20; row++) {
    const clase = row <= 4 ? "ejecutiva" : "economica";
    for (const col of ["A", "B", "C", "D", "E", "F"]) {
      seats.push({ vuelo_id: vueloId, numero: `${row}${col}`, clase, estado: "libre" });
    }
  }
  return seats; // 120 seats per flight
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

// Airports
for (const ap of AIRPORTS) {
  await pool.query(
    `INSERT INTO aeropuertos (codigo, nombre, ciudad, pais)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (codigo) DO NOTHING`,
    [ap.codigo, ap.nombre, ap.ciudad, ap.pais],
  );
}
console.log(`Airports: ${AIRPORTS.length} processed (ON CONFLICT DO NOTHING)`);

// Flights — insert and capture ids
const flightIds = [];
for (const fl of FLIGHTS) {
  const result = await pool.query(
    `INSERT INTO vuelos (codigo, origen, destino, salida, llegada)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (codigo) DO NOTHING
     RETURNING id`,
    [fl.codigo, fl.origen, fl.destino, fl.salida, fl.llegada],
  );

  if (result.rows.length > 0) {
    flightIds.push(result.rows[0].id);
  } else {
    // Flight already existed — fetch its id so we can check seats
    const existing = await pool.query(
      `SELECT id FROM vuelos WHERE codigo = $1`,
      [fl.codigo],
    );
    flightIds.push(existing.rows[0].id);
  }
}
console.log(`Flights: ${FLIGHTS.length} processed, ids: [${flightIds.join(", ")}]`);

// Seats — 120 per flight
let seatsInserted = 0;
for (const vueloId of flightIds) {
  const seats = buildSeats(vueloId);
  for (const seat of seats) {
    const result = await pool.query(
      `INSERT INTO asientos (vuelo_id, numero, clase, estado)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (vuelo_id, numero) DO NOTHING
       RETURNING id`,
      [seat.vuelo_id, seat.numero, seat.clase, seat.estado],
    );
    if (result.rows.length > 0) seatsInserted++;
  }
}
console.log(`Seats: ${seatsInserted} newly inserted (${FLIGHTS.length * 120} total slots)`);

// Optional sample reservations — only if an operator exists
const opResult = await pool.query(`SELECT id FROM operadores LIMIT 1`);
if (opResult.rows.length === 0) {
  console.log("No operators found — skipping sample reservations. Run db/seed.mjs first.");
} else {
  const operadorId = opResult.rows[0].id;

  // Insert one sample passenger and one sample reservation per flight (first seat)
  const SAMPLE_PASSENGERS = [
    { documento: "ARG-12345678", nombre: "María González" },
    { documento: "CHL-87654321", nombre: "Juan Pérez" },
    { documento: "COL-11223344", nombre: "Sofía Rodríguez" },
    { documento: "ITA-99887766", nombre: "Carlos Martínez" },
    { documento: "BRA-44332211", nombre: "Lucía Fernández" },
  ];

  for (let i = 0; i < flightIds.length; i++) {
    const vueloId = flightIds[i];
    const pasajero = SAMPLE_PASSENGERS[i];
    if (!pasajero) continue;

    // Upsert passenger
    const pasResult = await pool.query(
      `INSERT INTO pasajeros (documento, nombre)
       VALUES ($1, $2)
       ON CONFLICT (documento) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id`,
      [pasajero.documento, pasajero.nombre],
    );
    const pasajeroId = pasResult.rows[0].id;

    // Find the first seat of the flight
    const seatResult = await pool.query(
      `SELECT id FROM asientos WHERE vuelo_id = $1 ORDER BY id LIMIT 1`,
      [vueloId],
    );
    if (seatResult.rows.length === 0) continue;
    const asientoId = seatResult.rows[0].id;

    // Insert reservation if not already present
    const resResult = await pool.query(
      `INSERT INTO reservas (vuelo_id, asiento_id, pasajero_id, operador_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [vueloId, asientoId, pasajeroId, operadorId],
    );

    if (resResult.rows.length > 0) {
      // Mark the seat as occupied
      await pool.query(
        `UPDATE asientos SET estado = 'ocupado' WHERE id = $1`,
        [asientoId],
      );
      console.log(
        `Sample reservation: flight ${vueloId}, seat ${asientoId}, passenger "${pasajero.nombre}"`,
      );
    } else {
      console.log(
        `Sample reservation for flight ${vueloId} already exists — skipped`,
      );
    }
  }
}

// Verification summary
const counts = await pool.query(`
  SELECT
    (SELECT count(*) FROM aeropuertos) AS aeropuertos,
    (SELECT count(*) FROM vuelos)      AS vuelos,
    (SELECT count(*) FROM asientos)    AS asientos,
    (SELECT count(*) FROM pasajeros)   AS pasajeros,
    (SELECT count(*) FROM reservas)    AS reservas
`);
console.log("\nDB summary:", counts.rows[0]);

await pool.end();
