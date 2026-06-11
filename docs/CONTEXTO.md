# Contexto del proyecto — AeroReserva

> Documento de estado para el equipo. Resume **qué hay construido**, **qué es real vs.
> maquetado**, **qué falta**, **cómo levantarlo en otra máquina** y los **detalles no
> obvios** del stack.
> Para la visión, el stack y el modelo de datos completo, ver [`README.md`](../README.md).

Última actualización: 2026-06-11

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
│   │   ├── page.tsx           # Home: KPIs + próximos vuelos REAL
│   │   ├── vuelos/            # Tabla REAL + filtros autocomplete (ciudad/código)
│   │   ├── asientos/          # Mapa de asientos REAL + reservar desde el mapa
│   │   ├── reservas/          # Tabla + nueva reserva + ver detalle con auditoría
│   │   ├── reportes/          # Ocupación REAL (vistas SQL)
│   │   ├── lista-espera/      # Cola REAL + encolar pasajero, agrupada por vuelo
│   │   ├── auditoria/         # Bitácora REAL
│   │   ├── laboratorio/       # Demo visual de concurrencia (simulación)
│   │   ├── esquema/           # Diagrama ER interactivo (React Flow)
│   │   └── usuarios/          # CRUD de operadores REAL
│   └── api/
│       ├── health/            # GET  — chequeo de conexión a DB
│       ├── operadores/        # GET/POST + [id] PATCH/DELETE
│       ├── vuelos/            # GET  + [id]/asientos GET (?soloLibres)
│       ├── pasajeros/         # GET  — búsqueda por documento/nombre (autocomplete)
│       ├── lista-espera/      # POST — encolar pasajero (409 si ya está en el vuelo)
│       ├── reservas/          # POST/GET + [id] GET (detalle+auditoría) / PATCH (cancelar)
│       └── query-log/         # GET (snapshot) + explain POST — devtool dev-only
├── components/
│   ├── ui/                    # Primitivos shadcn / Base UI (NO tocar al auditar)
│   └── <feature>/             # Componentes por vista
├── lib/
│   ├── db.ts                  # Pool de pg + query() / withTransaction() (instrumentada → query-log)
│   ├── query-log.ts           # Ring buffer en memoria del SQL transaccional (dev-only)
│   ├── auth.ts                # getCurrentOperator(), roles, sesiones
│   ├── password.ts            # scrypt  "saltHex:derivedKeyHex"
│   ├── operadores.ts          # CRUD de operadores
│   ├── vuelos.ts              # listarVuelos/buscarVueloPorCodigo (JOIN aerolineas + aeropuertos → ciudad/nombre)
│   ├── aeropuertos.ts         # listarAeropuertos() — catálogo real (codigo/nombre/ciudad) de aeropuertos con vuelos
│   ├── asientos.ts            # listarAsientosDeVuelo(vueloId, {soloLibres})
│   ├── pasajeros.ts           # upsertPasajero(client) + buscarPasajeros(q) (autocomplete)
│   ├── reservas.ts            # crearReserva / listar / cancelar / obtenerReservaDetalle
│   ├── lista-espera.ts        # listar + encolarEnEspera (atómico, posición por vuelo)
│   └── bitacora.ts            # listarBitacora + obtenerAuditoriaDeRegistro(tabla, id)
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
  - `006_roles.sql` — roles `app_consulta` / `app_agente` / `app_admin` + GRANT/REVOKE por tabla
  - `007_bitacora.sql` — `bitacora` + función trigger `registrar_bitacora()` (SECURITY DEFINER) + triggers en reservas/asientos/pasajeros
  - `008_lista_espera.sql` — `lista_espera` + función/trigger `promover_lista_espera()` (promoción automática al cancelar)
  - `009_reportes.sql` — vistas `v_ocupacion_vuelo`, `v_ocupacion_aerolinea`, `v_resumen_kpis`
  - `010_estado_vuelo.sql` — `vuelos.estado` (programado/abordando/despegado/aterrizado/retrasado/cancelado) + `retraso_min`
  - `011_reportes_extra.sql` — vistas `v_vuelos_por_estado`, `v_ocupacion_ruta`, `v_retraso_aerolinea`, `v_top_aeropuertos`
  - (no existe `004`; quedó hueco en la numeración)
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
| **Vuelos** (tabla + filtros) | ✅ **Real (DB)** | `listarVuelos` paginado (25/pág) + `JOIN aerolineas` + `JOIN aeropuertos` (muestra **ciudad + nombre**, no solo el código IATA). Filtros origen/destino son **autocompletes buscables** (`AeropuertoCombobox`); fecha por querystring. |
| **Aerolíneas** | ✅ **Real (DB)** | Tabla `aerolineas` + FK; nombres reales de OpenFlights. |
| **Reservas** (crear/listar/cancelar) | ✅ **Real (DB)** | `crearReserva` transaccional (`FOR UPDATE` + UNIQUE parcial), diálogo conectado, cancelar (soft) cableado. Verificado end-to-end en navegador. El selector de pasajero es un combobox (buscar existente / crear nuevo). |
| **Reservas** (ver detalle + auditoría) | ✅ **Real (DB)** | `GET /api/reservas/[id]` → datos completos (pasajero, ruta, asiento, operador) **+ traza de auditoría** leída de `bitacora` con diff JSONB (`estado: confirmada → cancelada`). |
| **Asientos** (consulta) | ✅ **Real (DB)** | Vía `GET /api/vuelos/[id]/asientos?soloLibres` (lo usa el diálogo de reserva). |
| **Asientos** (mapa `/asientos`) | ✅ **Real (DB)** | Mapa con ocupación real del vuelo (`?vuelo=CODIGO`) y **reserva desde el mapa**: seleccionar asiento libre → diálogo → POST. Tras reservar se deselecciona y el tile pasa a ocupado. |
| **Home / Dashboard** | ✅ **Real (DB)** | KPIs reales (ocupación promedio sobre vuelos con reservas) + próximos vuelos con estado/ocupación (`src/lib/dashboard.ts`). |
| **Reportes** (ocupación) | ✅ **Real (DB)** | Vistas SQL de ocupación por vuelo/aerolínea + KPIs. |
| **Lista de espera** | ✅ **Real (DB)** | Tabla `lista_espera` + **encolar desde la UI** (`POST /api/lista-espera`, 409 si el pasajero ya está en el vuelo) + trigger PL/pgSQL que promueve automáticamente al cancelarse una reserva. La tabla se **agrupa por vuelo** (la posición es por vuelo, no global). |
| **Auditoría** (bitácora) | ✅ **Real (DB)** | Triggers AFTER INSERT/UPDATE/DELETE en reservas/asientos/pasajeros → `bitacora` (JSONB old/new + operador vía `app.current_operator`). `/auditoria` conectada. |
| **Roles/permisos DB** | ✅ **Real (motor)** | 3 roles Postgres con GRANT/REVOKE por tabla (`db/demo-roles.mjs` lo demuestra). La app aún se conecta como `postgres`. |
| **Modelo de datos (ER)** | ✅ **Real (DB)** | `/esquema`: diagrama ER interactivo (React Flow) generado leyendo `information_schema` — 10 tablas, 11 FKs. |
| **Query Log** (inspector SQL) | ✅ **Real (dev-only)** | Drawer flotante que muestra el SQL de **transacciones** (`BEGIN → FOR UPDATE → INSERT → UPDATE → COMMIT`) agrupado, con **EXPLAIN** por consulta + lectura del plan en español. Captura instrumentando `withTransaction`; snapshot bajo demanda. Solo se compila en desarrollo. |
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
- **Ruido de demo** (`db/seed-ruido.mjs`): ~428k reservas confirmadas → **~43% de ocupación
  global**, distribución variada por vuelo (0%–99%), y estados variados (retrasado/abordando/
  despegado/aterrizado/cancelado) en ~420 vuelos. El seed usa **carga masiva con triggers
  deshabilitados** (técnica DBA: `DISABLE TRIGGER` → bulk `INSERT...SELECT` → re-`ENABLE`).

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

Hecho ✅: catálogo en DB · capa de datos · **reservas transaccionales anti doble-reserva** ·
aerolíneas relacionadas · paginación e índices · **roles y permisos (GRANT/REVOKE)** ·
**auditoría con triggers** · **lista de espera con promoción automática (PL/pgSQL)** ·
**reportes con vistas SQL** (ocupación, rutas, retrasos, aeropuertos) · filtros de vuelos +
mapa de asientos reales · **dashboard con datos reales** · **paginación en todos los listados** ·
ruido de demo (~43% ocupación) · **reservar desde el mapa de asientos** · **encolar en lista de
espera desde la UI** · **detalle de reserva con traza de auditoría** (diff JSONB) · **Query Log /
inspector SQL** con EXPLAIN + lectura del plan en español · **nombres de aeropuertos** (ciudad +
nombre) en tabla, detalle y comboboxes · **filtros de aeropuerto como autocomplete buscable** ·
**selector de pasajero** (buscar existente / crear nuevo) en todos los diálogos de reserva/espera.

Pendiente (ordenado por dependencia / valor):
1. **Laboratorio ejecutable** (diferencial) — correr los escenarios de aislamiento/deadlock
   contra la DB, no solo animarlos. (El stress test de `db/` ya es una base.)
2. **Más diversidad de rutas** — el importer valida ~370 rutas de 67k (filtro estricto); con
   más rutas aparecerían más aerolíneas.
3. **Pendientes menores**: `cancelarReserva` no registra operador en bitácora (queda NULL); el
   dropdown de filtros de `/auditoria` lista tablas mock. La app podría usar `SET ROLE` por
   operador para que los permisos apliquen de verdad (defense-in-depth). El **detalle de reserva**
   muestra la ruta solo con el código del vuelo (falta extenderle ciudades como en `/vuelos`).
   Falta **validar end-to-end en navegador** el lote nuevo (reservar desde mapa, query log,
   detalle con auditoría, filtros autocomplete).

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
- **Charts con Recharts** — `/reportes` y el home usan Recharts (shadcn `ui/chart.tsx`), barras
  **verticales** (columnas). Son `"use client"`; las páginas Server pasan los datos por props.
  Gotcha: una captura `fullPage` de Playwright puede mostrarlos vacíos (el resize colapsa el
  `ResponsiveContainer`) — es artefacto de la captura, en el navegador renderizan bien.
- **Diagrama ER (React Flow)** — `/esquema` usa `@xyflow/react` + dagre; `src/lib/esquema.ts` lee
  tablas/columnas/FKs de `information_schema`. React Flow necesita un contenedor con ALTURA
  EXPLÍCITA (`h-[calc(100vh-13rem)]`); con `flex-1`/`h-full` colapsa a 0 y el lienzo queda vacío.
- **Paginación en todos los listados** — `/vuelos`, `/reservas`, `/auditoria`, `/lista-espera`,
  `/usuarios` paginan server-side (25/pág, `?page`) con `listarX({limit,offset})` + `contarX()`.
  No traer tablas enteras es parte de administrar bien la DB.
- **Select de vuelo = combobox con búsqueda** — con 6.667 vuelos un `<Select>` no sirve (y con
  la paginación solo traería 25). El diálogo de Nueva Reserva usa `vuelo-combobox.tsx` que busca
  **server-side** con debounce 250ms contra `GET /api/vuelos?q=` (filtra por código/origen/destino).
- **KPI de ocupación global ≈ 0%** — hay 1M de asientos y ~4.3k reservas, así que el % global
  redondea a 0. La ocupación real y variada se ve **por vuelo / por aerolínea** (vistas), no en
  el agregado global. Si la demo necesita un % global vistoso, reducir el catálogo o calcular el
  KPI solo sobre vuelos con reservas.
- **Dropdown en portal (overflow-hidden).** El `AeropuertoCombobox` (filtros de `/vuelos`) se
  recortaba porque la `Card` (`ui/card.tsx`) tiene `overflow-hidden`. Solución: renderizar el
  dropdown con `createPortal(document.body)` + posición `fixed` calculada con `getBoundingClientRect`,
  reposicionando en scroll/resize, y el click-afuera verifica trigger **y** dropdown. Mismo patrón
  a aplicar si el `vuelo-combobox` se recorta en algún contenedor.
- **Query Log captura SOLO transacciones.** `query()` standalone NO se registra (eran los SELECT
  de cada pantalla → ruido); solo el proxy de `withTransaction` graba (con `txId`). Es **dev-only**
  (`QUERY_LOG_ENABLED = NODE_ENV !== 'production'`) y **sin streaming**: snapshot por `GET /api/query-log`
  + botón Actualizar. `queryRaw()` en `db.ts` ejecuta sin registrar (lo usa el endpoint EXPLAIN para
  no contaminar el log).
- **EXPLAIN no se traduce.** Los nombres de nodos del plan (`Seq Scan`, `Index Scan`…) son fijos en
  inglés en PostgreSQL (`lc_messages` solo traduce errores). Por eso el query log muestra el plan
  crudo **+ una capa de interpretación en español** (`plan-interpreter.tsx`). El EXPLAIN ANALYZE solo
  se usa en `SELECT`; en escrituras se usa `EXPLAIN` sin `ANALYZE` para no ejecutar el INSERT/UPDATE.
- **Posición de lista de espera es POR VUELO.** `encolarEnEspera` calcula `MAX(posicion)+1 WHERE vuelo_id`,
  así que varios "1" (uno por vuelo) son correctos. La tabla `/lista-espera` se **agrupa por vuelo**
  para que se entienda; no es un bug de datos.
- **Tile de asiento: "seleccionado" gana sobre "ocupado".** En `seat-button.tsx` el estilo de
  seleccionado tiene prioridad sobre el status. Tras reservar desde el mapa hay que **deseleccionar**
  (el diálogo llama `onReserved` → `setSelectedId(null)`); con `router.refresh()` el tile pinta su
  estado ocupado real.
- **`listarAeropuertos` lee la tabla real.** Antes armaba la lista con un UNION de códigos de `vuelos`
  y ponía el código como nombre (por eso los selects solo mostraban abreviaciones). Ahora hace
  `SELECT codigo, nombre, ciudad FROM aeropuertos WHERE codigo IN (origen/destino de vuelos)`.
- **Selector de pasajero = combobox.** Con ~9.3k pasajeros, los diálogos de reserva/espera no piden
  teclear: `PasajeroCombobox` busca existentes (`GET /api/pasajeros?q=`) o crea uno nuevo inline. El
  backend sigue haciendo `upsertPasajero` por documento, así que el contrato del POST no cambió.

---

## 8. Calidad — auditoría de accesibilidad (2026-06-10)

Se auditó toda la capa HTML/JSX (páginas + componentes propios; los primitivos `ui/` exentos).
Hallazgos corregidos en `fix(a11y)`: doble `<h1>` por página demotado a `<p>`; metadata
`%s — AeroReserva` por página; nombre accesible (`aria-label`) + `scope="col"` en tablas;
regiones vivas en auditoría/laboratorio; `required`/`aria-required` en formularios; varios
menores. El proyecto ya venía sólido en a11y (mapa de asientos, diálogos, sidebar).
