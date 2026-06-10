import { query } from "@/lib/db";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ColumnaInfo {
  nombre: string;
  tipo: string;
  nullable: boolean;
  esPK: boolean;
  esFK: boolean;
}

export interface TablaInfo {
  nombre: string;
  columnas: ColumnaInfo[];
}

export interface RelacionFK {
  origen: string;
  columnaOrigen: string;
  destino: string;
  columnaDestino: string;
  constraint: string;
}

export interface EsquemaDB {
  tablas: TablaInfo[];
  relaciones: RelacionFK[];
}

// ── Internal row types ───────────────────────────────────────────────────────

interface ColumnaRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  ordinal_position: number;
}

interface PKRow {
  table_name: string;
  column_name: string;
}

interface FKRow {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

// ── Queries ──────────────────────────────────────────────────────────────────

async function fetchColumnas(): Promise<ColumnaRow[]> {
  return query<ColumnaRow>(`
    SELECT
      c.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.ordinal_position
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name   = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type   = 'BASE TABLE'
    ORDER BY c.table_name, c.ordinal_position
  `);
}

async function fetchPKs(): Promise<PKRow[]> {
  return query<PKRow>(`
    SELECT
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema    = tc.table_schema
    WHERE tc.table_schema    = 'public'
      AND tc.constraint_type = 'PRIMARY KEY'
  `);
}

async function fetchFKs(): Promise<FKRow[]> {
  return query<FKRow>(`
    SELECT
      tc.constraint_name,
      kcu.table_name,
      kcu.column_name,
      ccu.table_name  AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema    = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema    = tc.table_schema
    WHERE tc.table_schema    = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.constraint_name
  `);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Read the full relational schema from the PostgreSQL catalog at runtime.
 * Queries `information_schema` — no hardcoded table names.
 */
export async function obtenerEsquema(): Promise<EsquemaDB> {
  const [columnaRows, pkRows, fkRows] = await Promise.all([
    fetchColumnas(),
    fetchPKs(),
    fetchFKs(),
  ]);

  // Build lookup sets for PKs and FKs per table
  const pkSet = new Set(pkRows.map((r) => `${r.table_name}.${r.column_name}`));
  const fkSet = new Set(fkRows.map((r) => `${r.table_name}.${r.column_name}`));

  // Group columns by table
  const tableMap = new Map<string, ColumnaInfo[]>();
  for (const row of columnaRows) {
    const key = `${row.table_name}.${row.column_name}`;
    const columna: ColumnaInfo = {
      nombre: row.column_name,
      tipo: row.data_type,
      nullable: row.is_nullable === "YES",
      esPK: pkSet.has(key),
      esFK: fkSet.has(key),
    };
    const cols = tableMap.get(row.table_name);
    if (cols) {
      cols.push(columna);
    } else {
      tableMap.set(row.table_name, [columna]);
    }
  }

  const tablas: TablaInfo[] = Array.from(tableMap.entries()).map(
    ([nombre, columnas]) => ({ nombre, columnas }),
  );

  const relaciones: RelacionFK[] = fkRows.map((r) => ({
    origen: r.table_name,
    columnaOrigen: r.column_name,
    destino: r.foreign_table_name,
    columnaDestino: r.foreign_column_name,
    constraint: r.constraint_name,
  }));

  return { tablas, relaciones };
}
