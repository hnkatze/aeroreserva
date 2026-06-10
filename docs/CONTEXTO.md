# Contexto del proyecto — AeroReserva

> Documento de estado para el equipo. Resume **qué hay construido**, **qué es real vs.
> maquetado**, **qué falta**, **cómo levantarlo en otra máquina** y los **detalles no
> obvios** del stack.
> Para la visión, el stack y el modelo de datos completo, ver [`README.md`](../README.md).

Última actualización: 2026-06-10

---

## 1. En una frase

AeroReserva es un sistema de reservas de vuelos para agentes/cajeros, construido como
proyecto de **Administración de Bases de Datos**. El valor está en lo que ocurre **dentro
de PostgreSQL**: transacciones ACID, concurrencia (`SELECT ... FOR UPDATE`), integridad
referencial, funciones/triggers, auditoría, roles y optimización. La UI es el escaparate;
la base de datos es el producto.

---

## 2. Arquitectura actual

```
src/
├── app/
│   ├── (auth)/login/          # Login de operadores (Client Component)
│   ├── (dashboard)/           # Shell autenticado (sidebar + header)
│   │   ├── page.tsx           # Home: KPIs + próximos vuelos   (mock)
│   │   ├── vuelos/            # Tabla de vuelos REAL + paginación
│   │   ├── asientos/          # Mapa de asientos (mock visual)
│   │   ├── reservas/          # Tabla + diálogo "nueva reserva" REAL
│   │   ├── reportes/          # Ocupación (mock)
│   │   ├── lista-espera/      # Cola de espera (mock)
│   │   ├── auditoria/         # Bitácora (mock)
│   │   ├── laboratorio/       # Demo visual de concurrencia (mock)
│   │   └── usuarios/          # CRUD de operadores REAL
│   └── api/
│       ├── health/            # GET  — chequeo de conexión a DB
│       ├── operadores/        # GET/POST + [id] PATCH/DELETE
│       ├── vuelos/            # GET  + [id]/asientos GET (?soloLibres)
│       └── reservas/          # POST/GET + [id] PATCH (cancelar)
├── components/
│   ├── ui/                    # Primitivos shadcn / Base UI (NO tocar al auditar)
│   └── <feature>/             # Componentes por vista
├── lib/
│   ├── db.ts                  # Pool de pg + query() / withTransaction()
│   ├── auth.ts                # getCurrentOperator(), roles, sesiones
│   ├── password.ts            # scrypt  "saltHex:derivedKeyHex"
│   ├── operadores.ts          # CRUD de operadores
│   ├── vuelos.ts              # listarVuelos({limit,offset}) + contarVuelos() (JOIN aerolineas)
│   ├── asientos.ts            # listarAsientosDeVuelo(vueloId, {soloLibres})
│   ├── pasajeros.ts           # upsertPasajero(client, ...) — recibe PoolClient
│   └── reservas.ts            # crearReserva / listarReservas / cancelarReserva
└── proxy.ts                   # Protección de rutas (Next 16: antes "middleware")
```

- **Capa de datos:** PostgreSQL en **Railway** (nube), acceso con `pg` **sin ORM**
  (decisión deliberada). `src/lib/db.ts` expone un `Pool` cacheado en `globalThis` y los
  helpers `query()` y `withTransaction()`. `DATABASE_URL` vive en `.env.local` (gitignored).
  > Nota: el README todavía menciona Postgres en Docker local — ese fue el setup inicial.
  > Hoy la DB activa es Railway (ver §4).
- **Migraciones** (`db/migrations/`, se aplican a mano — ver §5):
  - `001_auth.sql` — `operadores`, `sesiones`
  - `002_catalogo.sql` — `aeropuertos`, `vuelos`, `asientos`
  - `003_reservas.sql` — `pasajeros`, `reservas` (+ índice UNIQUE parcial anti doble-reserva)
  - `005_aerolineas.sql` — `aerolineas` + FK `vuelos.aerolinea_codigo`
  - (no existe `004`; la lista de espera quedó pendiente)
- **Auth:** login de extremo a extremo, password scrypt, sesiones server-side en `sesiones`.
  Protección de rutas en `src/proxy.ts` (chequeo optimista de cookie → redirect a `/login`).
- **Estilo:** identidad **navy + ámbar** sobre slate en `globals.css` con oklch (Tailwind v4,
  CSS-first; no hay `tailwind.config`). Dark mode por `prefers-color-scheme`, no por clase.

---

## 3. Estado por módulo — real vs. maquetado

| Módulo | Estado | Detalle |
|--------|--------|---------|
| Login / sesiones / roles | ✅ **Real (DB)** | Tablas, scrypt, login, `proxy.ts` protege el dashboard. |
| `/api/health` | ✅ **Real (DB)** | Verifica conexión al pool. |
| CRUD **usuarios/operadores** | ✅ **Real (DB)** | `src/lib/operadores.ts` + routes + UI. |
| **Vuelos** (tabla) | ✅ **Real (DB)** | `listarVuelos` paginado (25/pág) + `JOIN aerolineas`. Página `/vuelos` conectada. **Filtros origen/destino/fecha aún NO cableados** a la query. |
| **Aerolíneas** | ✅ **Real (DB)** | Tabla `aerolineas` + FK; nombres reales de OpenFlights. |
| **Reservas** (crear/listar/cancelar) | ✅ **Real (DB)** | `crearReserva` transaccional (`FOR UPDATE` + UNIQUE parcial), diálogo conectado, cancelar (soft) cableado. Verificado end-to-end en navegador. |
| **Asientos** (consulta) | ✅ **Real (DB)** | Vía `GET /api/vuelos/[id]/asientos?soloLibres` (lo usa el diálogo de reserva). |
| Asientos (mapa `/asientos`) | 🟡 **Mock** | La vista del mapa interactivo sigue con datos de ejemplo. |
| Home (KPIs, próximos vuelos) | 🟡 **Mock** | Datos hardcodeados. |
| Reportes (ocupación) | 🟡 **Mock** | KPIs + barras + tabla de ejemplo. |
| Lista de espera | 🟡 **Mock** | Cola visual; sin lógica real. |
| Auditoría (bitácora) | 🟡 **Mock** | Sin triggers que la llenen. |
| Laboratorio de concurrencia | 🟡 **Simulación** | Anima escenarios **sin** ejecutar SQL real. |

---

## 4. Levantar el proyecto en una máquina nueva

La DB vive en **Railway (nube)**, así que **no hace falta recrear ni recargar nada** — solo
apuntar el `.env.local` a la misma `DATABASE_URL` y la app encuentra todos los datos.

1. **Clonar** (el repo es `hnkatze/aeroreserva`).
2. `npm install`.
3. Crear **`.env.local`** en la raíz con:
   ```
   DATABASE_URL="postgresql://postgres:<PASSWORD>@acela.proxy.rlwy.net:49750/railway"
   ```
   > ⚠️ La password **NO está en este doc ni en el repo** (es un secreto). Sacala del
   > dashboard de Railway (proyecto → Postgres → Connect) o de tu gestor de credenciales.
4. `npm run dev` → http://localhost:3000
5. **Login:** `admin` / `admin123` (operador admin que ya existe en la DB).

> Si alguna vez recreás la DB desde cero: aplicá las migraciones de `db/migrations/` en
> orden (ver §5) y luego corré el importer de catálogo. Pero contra la Railway actual **no
> es necesario**.

**Para pushear** (ver §5, gotcha de git): el remote es SSH con la clave de otra cuenta; usar
la cuenta `gh` de `hnkatze` y pushear por HTTPS.

---

## 5. Datos cargados y herramientas `db/`

**Datos reales en Railway** (OpenFlights, dominio público):
- ~6.071 **aeropuertos** reales (IATA) · 6.667 **vuelos** · **1.000.050 asientos** (150/vuelo)
- 5 **aerolíneas** (ICAO): TOM=Thomsonfly, TCX=Thomas Cook, IOS=Isles of Scilly Skybus,
  NHG=NHT Lineas Aereas, ABJ=Abaet.

**Scripts** (se corren con `node`, no hay tarea npm):
| Script | Para qué |
|--------|----------|
| `db/seed.mjs` | Crea el operador admin (`admin`/`admin123`). |
| `db/import-openflights.mjs` | Importer real parametrizable (descarga OpenFlights). |
| `db/backfill-aerolineas.mjs` | Puebla `aerolineas` y vincula vuelos existentes. |
| `db/benchmark.mjs` | Mide latencia + `EXPLAIN ANALYZE` de las queries reales. |
| `db/stress-concurrency.mjs` | Reservas concurrentes; prueba anti doble-reserva bajo carga. |
| `db/seed-catalog.mjs` | Seed de catálogo de muestra (LATAM) — legado, reemplazado por OpenFlights. |

**Comandos útiles** (`--env-file=.env.local` lee la `DATABASE_URL`):
```bash
# Recargar el catálogo (⚠️ --reset BORRA y recrea: 1M de asientos, ~10 min)
node --env-file=.env.local db/import-openflights.mjs --reset --vuelos=6667 --asientos=150

# Medir performance de lectura sobre el volumen actual
node --env-file=.env.local db/benchmark.mjs

# Probar concurrencia de escritura (anti doble-reserva)
node --env-file=.env.local db/stress-concurrency.mjs
```

**Hallazgo de performance:** con 1M de asientos, PostgreSQL resuelve las queries
**server-side en <4 ms** (índices). El cuello de botella es la **latencia de red** al proxy
de Railway (~66 ms por round-trip), constante e independiente del volumen. Paginar `/vuelos`
sí ayuda (reduce filas transferidas); un índice parcial extra en `asientos` no movió la aguja.

---

## 6. Lo que falta — roadmap

Hecho ✅: catálogo en DB · capa de datos de vuelos/asientos · **reservas transaccionales
anti doble-reserva** · aerolíneas relacionadas · paginación e índices base.

Pendiente (ordenado por dependencia / valor):
1. **Conectar `/asientos`** (mapa interactivo) y los **filtros de `/vuelos`** a datos reales.
2. **Lista de espera con promoción** — encolar + promover al liberarse un asiento (función/trigger).
3. **Auditoría real** — triggers `AFTER INSERT/UPDATE/DELETE` que escriban en `bitacora`;
   conectar `/auditoria`. (Decidir cómo registrar el operador: la bitácora usa `usuario_bd`
   pero el pool tiene un solo usuario → pasar contexto con `SET LOCAL`.)
4. **Roles y permisos** — `GRANT`/`REVOKE` mapeados a `agente / admin / consulta`.
5. **Reportes con SQL real** — vistas de ocupación + `EXPLAIN ANALYZE`.
6. **Home con datos reales** — KPIs y próximos vuelos.
7. **Laboratorio ejecutable** (diferencial) — correr los escenarios de aislamiento/deadlock
   contra la DB, no solo animarlos. (El stress test de `db/` ya es una base.)
8. **Más diversidad de rutas** — el importer valida ~370 rutas de 67k (filtro estricto); con
   más rutas aparecerían más aerolíneas.

---

## 7. Detalles no obvios (gotchas)

- **DB en Railway, no Docker.** La `DATABASE_URL` apunta al proxy `acela.proxy.rlwy.net`. La
  latencia de red domina los tiempos (ver §5). La conexión funciona **sin** `sslmode`.
- **Migraciones a mano.** No hay runner npm. Patrón para aplicar un `.sql`:
  ```bash
  DATABASE_URL="..." node -e "const{Pool}=require('pg');const fs=require('fs');\
  const sql=fs.readFileSync('db/migrations/00X_x.sql','utf8');const p=new Pool({connectionString:process.env.DATABASE_URL});\
  p.query(sql).then(()=>p.end())"
  ```
- **Anti doble-reserva.** Doble barrera: `SELECT ... FOR UPDATE` sobre la fila del asiento
  **+** índice `UNIQUE (vuelo_id, asiento_id) WHERE estado <> 'cancelada'`
  (`ux_reservas_vuelo_asiento`). En el código se mapea el error pg `23505` filtrando por
  `error.constraint` → `AsientoOcupadoError` → HTTP 409. Cancelar es **soft** (`estado='cancelada'`)
  y libera el asiento, por eso el índice es parcial (permite re-reservar).
- **`upsertPasajero` recibe `PoolClient`** — debe correr dentro de la transacción de `crearReserva`,
  no con `query()` del pool.
- **git push.** El remote es SSH (`git@github.com:hnkatze/...`) y la clave de la máquina es de
  otra cuenta (`HectorHCIT`, sin acceso) → "Permission denied". Para pushear:
  `gh auth switch --user hnkatze && gh auth setup-git` y push por HTTPS
  (`git push https://github.com/hnkatze/aeroreserva.git HEAD:main`). Para dejar `git push origin`
  directo, cambiar el remote a HTTPS.
- **Aerolíneas son ICAO de 3 letras.** El código de vuelo (`TOM1420`) embebe el código de
  aerolínea (`TOM`); `vuelos.aerolinea_codigo` referencia `aerolineas(codigo)`.
- **Next.js 16 tiene breaking changes** (ver `AGENTS.md`). Leer `node_modules/next/dist/docs/`
  antes de tocar Route Handlers / Server Actions. `searchParams` y `params` son **async** (`await`).
  APIs que tocan la DB declaran `export const dynamic = 'force-dynamic'`.
- **`middleware` → `proxy`**: el archivo es `src/proxy.ts`.
- **Base UI `Button` como `Link`**: pasar `nativeButton={false}` al renderizar con `render={<Link/>}`.
- **Dark mode** por `prefers-color-scheme`, no por clase `.dark`.
- **Las reglas en `.claude/rules/` mezclan ejemplos de Angular** — es React/Next: aplicar el
  *principio*, no la API de Angular.
- **Metadata sólo en Server Components** — `/login` es Client Component.

---

## 8. Calidad — auditoría de accesibilidad (2026-06-10)

Se auditó toda la capa HTML/JSX (páginas + componentes propios; los primitivos `ui/` exentos).
Hallazgos corregidos en `fix(a11y)`: doble `<h1>` por página demotado a `<p>`; metadata
`%s — AeroReserva` por página; nombre accesible (`aria-label`) + `scope="col"` en tablas;
regiones vivas en auditoría/laboratorio; `required`/`aria-required` en formularios; varios
menores. El proyecto ya venía sólido en a11y (mapa de asientos, diálogos, sidebar).
