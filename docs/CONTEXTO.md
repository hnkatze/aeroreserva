# Contexto del proyecto — AeroReserva

> Documento de estado para el equipo. Resume **qué hay construido**, **qué es real vs.
> maquetado**, **qué falta** y los **detalles no obvios** del stack.
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
│   ├── (auth)/login/          # Login de operadores  (Client Component)
│   ├── (dashboard)/           # Shell autenticado (layout con sidebar + header)
│   │   ├── page.tsx           # Home: KPIs + próximos vuelos
│   │   ├── vuelos/            # Filtros + tabla de vuelos
│   │   ├── asientos/          # Mapa de asientos interactivo
│   │   ├── reservas/          # Tabla + diálogo "nueva reserva"
│   │   ├── reportes/          # Ocupación: KPIs + barras + tabla
│   │   ├── lista-espera/      # Cola de espera (#1 destacado)
│   │   ├── auditoria/         # Bitácora técnica (INSERT/UPDATE/DELETE)
│   │   ├── laboratorio/       # Demo visual de concurrencia
│   │   └── usuarios/          # CRUD de operadores
│   └── api/
│       └── health/            # GET /api/health  (chequeo de conexión a DB)
├── components/
│   ├── ui/                    # Primitivos shadcn / Base UI (NO tocar al auditar)
│   ├── app-sidebar.tsx        # Sidebar navy fija + nav accesible
│   ├── dashboard-header.tsx   # Barra superior (búsqueda, avatar, logout)
│   └── <feature>/             # Componentes por vista
├── lib/
│   ├── db.ts                  # Pool de pg + query() / withTransaction()
│   ├── auth.ts                # getCurrentOperator(), roles, sesiones
│   └── operadores.ts          # Capa de datos del CRUD de operadores
└── proxy.ts                   # Protección de rutas (Next 16: antes "middleware")
```

- **Capa de datos:** PostgreSQL 17 en Docker (`postgres-dev`, base `aeroreserva`), acceso con
  `pg` **sin ORM** (decisión deliberada). `src/lib/db.ts` expone un `Pool` cacheado en
  `globalThis` y los helpers `query()` y `withTransaction()`. `DATABASE_URL` vive en
  `.env.local` (gitignored).
- **Auth:** tablas `operadores` + `sesiones` (`db/migrations/001_auth.sql`), password hasheado,
  login de extremo a extremo. La protección de rutas vive en `src/proxy.ts` (chequeo optimista
  de cookie → redirect a `/login`).
- **Estilo:** identidad **navy + ámbar** sobre slate, definida en `globals.css` con oklch
  (Tailwind v4, config CSS-first; no hay `tailwind.config`). El dark mode hoy responde a
  `prefers-color-scheme`, **no** a una clase `.dark` togglable.

---

## 3. Estado por módulo — real vs. maquetado

| Módulo | Estado | Detalle |
|--------|--------|---------|
| Login / sesiones / roles | ✅ **Real (DB)** | Tablas, hash, login, `proxy.ts` protege el dashboard. |
| `/api/health` | ✅ **Real (DB)** | Verifica conexión al pool. |
| CRUD de **usuarios/operadores** | ✅ **Real (DB)** | `src/lib/operadores.ts` + route handlers + UI con diálogos. |
| Home (KPIs, próximos vuelos) | 🟡 **Mock** | Datos de ejemplo hardcodeados. |
| Vuelos (filtros + tabla) | 🟡 **Mock** | 8 filas de ejemplo región LATAM. |
| Asientos (mapa interactivo) | 🟡 **Mock** | Selección visual; sin persistencia. |
| Reservas (tabla + diálogo) | 🟡 **Mock** | El diálogo no escribe en DB todavía. |
| Reportes (ocupación) | 🟡 **Mock** | KPIs + barras + tabla con datos de ejemplo. |
| Lista de espera | 🟡 **Mock** | Cola visual; promoción no ejecuta lógica real. |
| Auditoría (bitácora) | 🟡 **Mock** | Tabla técnica; aún no hay triggers que la llenen. |
| Laboratorio de concurrencia | 🟡 **Simulación** | Anima aislamiento/doble-reserva/deadlock **sin** ejecutar SQL real. |

> Regla mental: **todo lo de operadores/auth es real; todo lo del dominio de vuelos es
> maqueta** hasta que exista el catálogo en la DB.

---

## 4. Lo que falta — roadmap ("qué esperamos")

Ordenado por dependencia. Esto es el terreno natural para planear con SDD.

1. **Catálogo en la DB** — migraciones + seed de `aeropuertos`, `vuelos`, `asientos`
   (con las restricciones del README: `UNIQUE(vuelo_id, numero)`, etc.).
2. **Capa de datos de vuelos/asientos** — funciones tipadas en `src/lib/` y conectar
   home, `/vuelos` y `/asientos` a datos reales.
3. **Reservas transaccionales** — `withTransaction()` + `SELECT ... FOR UPDATE` +
   `UNIQUE(vuelo_id, asiento_id)` como barrera **anti doble-reserva**. Es el corazón del proyecto.
4. **Lista de espera con promoción** — encolar y promover automáticamente al liberarse un asiento
   (función/trigger).
5. **Auditoría real** — triggers `AFTER INSERT/UPDATE/DELETE` que escriban en `bitacora`;
   conectar `/auditoria` a esos registros.
6. **Programación en el motor** — funciones PL/pgSQL y triggers (reserva/cancelación atómicas).
7. **Roles y permisos** — `GRANT`/`REVOKE` mapeados a `agente / admin / consulta`.
8. **Reportes con SQL real** — vistas de ocupación + `EXPLAIN ANALYZE`.
9. **Laboratorio ejecutable** (opcional/diferencial) — correr de verdad los escenarios de
   aislamiento y deadlock contra la DB, no solo animarlos.
10. **Índices y optimización** — sobre las consultas calientes de reservas/reportes.

---

## 5. Detalles no obvios (gotchas)

- **Next.js 16 tiene breaking changes** (ver `AGENTS.md`). Antes de tocar código de app, leer
  la guía en `node_modules/next/dist/docs/`. No confiar en suposiciones de versiones viejas.
- **`middleware` → `proxy`**: en Next 16 el convención de archivo se renombró. El archivo es
  `src/proxy.ts` y exporta `export function proxy(request)` + `config.matcher`.
- **Base UI `Button` como `Link`**: el `Button` (shadcn sobre Base UI) trae `nativeButton=true`
  por defecto. Al renderizarlo como link (`render={<Link/>}`, que produce un `<a>`) hay que pasar
  `nativeButton={false}` o tira error de runtime.
- **APIs que tocan la DB** deben declarar `export const dynamic = 'force-dynamic'`.
- **Dark mode** va por `prefers-color-scheme`, no por clase — ojo antes de agregar variantes `dark:`.
- **Las reglas en `.claude/rules/` mezclan ejemplos de Angular** (`@Injectable`, `(click)=`,
  `ng build`). Es un proyecto React/Next: aplicar el *principio*, no la API de Angular.
- **Metadata sólo en Server Components** — `/login` es Client Component, así que su `<title>`
  no se setea con `export const metadata`.

---

## 6. Calidad — auditoría de accesibilidad (2026-06-10)

Se auditó toda la capa HTML/JSX (las 13 páginas + componentes propios; los primitivos `ui/`
quedan exentos). Hallazgos corregidos en `fix(a11y)`:

- **Doble `<h1>` por página** — el header repetía un `<h1>` fijo; se demotó a `<p>` para dejar
  un único encabezado real por vista.
- **Metadata** — se reemplazó el placeholder de create-next-app por un template
  `%s — AeroReserva` + `title`/`description` por página.
- **Tablas** — nombre accesible (`aria-label`) en las 6 tablas de datos + `scope="col"`.
- **Regiones vivas** — filtro de auditoría siempre montado, `aria-live` sobre el nodo que cambia,
  pasos del laboratorio anunciados.
- **Formularios** — `required`/`aria-required` y pista persistente de contraseña en el alta de operadores.
- Varios menores (separadores de ruta para lectores, etiquetas KPI enriquecidas, leyenda de
  asientos que era un `<nav>` falso).

El proyecto ya venía sólido en a11y (mapa de asientos, diálogos y sidebar bien resueltos).
