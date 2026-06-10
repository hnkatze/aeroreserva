/**
 * demo-roles.mjs
 *
 * Demonstrates the three PostgreSQL roles (app_consulta, app_agente,
 * app_admin) by attempting a fixed battery of operations under each role
 * and reporting whether the operation was PERMITTED or DENIED.
 *
 * Technique: for each role we open a transaction, activate the role with
 * SET LOCAL ROLE (scoped to the transaction), run each operation in its
 * own SAVEPOINT so a permission error does not abort the whole transaction,
 * then ROLLBACK so no demo data is left behind.
 *
 * Run:
 *   node --env-file=.env.local db/demo-roles.mjs
 * or inline:
 *   DATABASE_URL="postgresql://..." node db/demo-roles.mjs
 */

import pg from 'pg';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Operations to attempt under each role
// Each entry: { label, sql, params? }
// ---------------------------------------------------------------------------
const OPERATIONS = [
  {
    label: 'SELECT count(*) FROM vuelos',
    sql: 'SELECT count(*) FROM vuelos',
  },
  {
    label: 'SELECT count(*) FROM operadores',
    sql: 'SELECT count(*) FROM operadores',
  },
  {
    label: "INSERT INTO pasajeros (documento, nombre) VALUES ('DEMO-ROL', 'x')",
    sql: "INSERT INTO pasajeros (documento, nombre) VALUES ('DEMO-ROL', 'x')",
  },
  {
    label: "UPDATE asientos SET estado='libre' WHERE id=1",
    sql: "UPDATE asientos SET estado='libre' WHERE id=1",
  },
  {
    label: 'DELETE FROM vuelos WHERE id=-1',
    sql: 'DELETE FROM vuelos WHERE id=-1',
  },
];

const ROLES = ['app_consulta', 'app_agente', 'app_admin'];

// Expected outcomes for display verification
// true = permitted, false = denied
const EXPECTED = {
  app_consulta: [true,  false, false, false, false],
  app_agente:   [true,  false, true,  true,  false],
  app_admin:    [true,  true,  true,  true,  true ],
};

// ---------------------------------------------------------------------------
// Result matrix: roleResults[role][opIndex] = { ok, error? }
// ---------------------------------------------------------------------------
const roleResults = {};

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

for (const role of ROLES) {
  roleResults[role] = [];

  // Open transaction and set role (LOCAL means it resets on COMMIT/ROLLBACK)
  await client.query('BEGIN');
  await client.query(`SET LOCAL ROLE ${role}`);

  for (let i = 0; i < OPERATIONS.length; i++) {
    const op = OPERATIONS[i];
    const sp = `sp_${role.replace(/-/g, '_')}_${i}`;

    await client.query(`SAVEPOINT ${sp}`);

    try {
      await client.query(op.sql);
      await client.query(`RELEASE SAVEPOINT ${sp}`);
      roleResults[role].push({ ok: true });
    } catch (err) {
      // Roll back to the savepoint so the transaction remains usable
      await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      await client.query(`RELEASE SAVEPOINT ${sp}`);

      const isPerm =
        err.code === '42501' ||                // insufficient_privilege
        (err.message && err.message.includes('permission denied'));

      roleResults[role].push({ ok: false, error: isPerm ? 'permission denied' : err.message });
    }
  }

  // Discard any demo data (INSERT above would have been rolled back anyway)
  await client.query('ROLLBACK');
}

await client.end();

// ---------------------------------------------------------------------------
// Print results table
// ---------------------------------------------------------------------------
const COL_OP   = 52;
const COL_ROLE = 14;

const hr = '-'.repeat(COL_OP + ROLES.length * COL_ROLE + 4);

console.log('\n' + hr);
console.log(
  'Operation'.padEnd(COL_OP) +
  ROLES.map(r => r.padEnd(COL_ROLE)).join('')
);
console.log(hr);

for (let i = 0; i < OPERATIONS.length; i++) {
  const op = OPERATIONS[i];
  const label = op.label.length > COL_OP - 2
    ? op.label.slice(0, COL_OP - 5) + '...'
    : op.label;

  const cells = ROLES.map(role => {
    const res = roleResults[role][i];
    return (res.ok ? '✅ allowed' : '🚫 denied').padEnd(COL_ROLE);
  });

  console.log(label.padEnd(COL_OP) + cells.join(''));
}

console.log(hr);

// ---------------------------------------------------------------------------
// Verification: check against expected outcomes
// ---------------------------------------------------------------------------
console.log('\nVerification against expected outcomes:');
let allMatch = true;

for (const role of ROLES) {
  const expected = EXPECTED[role];
  for (let i = 0; i < OPERATIONS.length; i++) {
    const actual = roleResults[role][i].ok;
    const exp    = expected[i];
    if (actual !== exp) {
      console.log(`  MISMATCH  ${role} / op[${i}]: expected ${exp ? 'allowed' : 'denied'}, got ${actual ? 'allowed' : 'denied'}`);
      allMatch = false;
    }
  }
}

if (allMatch) {
  console.log('  All results match expected outcomes.');
} else {
  console.log('\n  NOTE: Mismatches may indicate inherited public schema privileges.');
  console.log('  Check pg_default_acl and schema-level grants if unexpected.');
}

console.log('');
