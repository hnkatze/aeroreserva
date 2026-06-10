// Dev seed: creates a default admin operator so you can log in.
// Run with:  node --env-file=.env.local db/seed.mjs
import { Pool } from "pg";
import { scryptSync, randomBytes } from "node:crypto";

function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const username = "admin";
const password = "admin123";
const role = "admin";

await pool.query(
  `INSERT INTO operadores (username, password_hash, role)
   VALUES ($1, $2, $3)
   ON CONFLICT (username)
   DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
  [username, hashPassword(password), role],
);

console.log(`Seeded operator -> ${username} / ${password} (${role})`);
await pool.end();
