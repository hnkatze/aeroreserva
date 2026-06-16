# AeroReserva

> Sistema de reservas de vuelos para **agentes de viaje y cajeros de aerolínea**, construido como proyecto de **Administración de Bases de Datos**. El foco no es la interfaz, sino **lo que ocurre dentro de la base de datos**: transacciones ACID, control de concurrencia, integridad referencial, lógica en el motor (funciones y triggers), auditoría, roles y optimización.

Cada reserva es una **transacción ACID**; el sistema usa **bloqueos** (`SELECT ... FOR UPDATE`) para que dos reservas simultáneas del mismo asiento no se pisen, y mantiene **integridad referencial** estricta. Sobre ese núcleo se construyen capas de administración: funciones y triggers, una bitácora de auditoría automática, roles y permisos, una lista de espera con promoción automática, demostraciones de niveles de aislamiento y deadlocks, e índices y reportes.

## Stack

| Capa | Tecnología |
|------|-----------|
| Base de datos | PostgreSQL 17 (Docker) |
| Acceso a datos | `pg` (node-postgres) — **SQL directo, sin ORM** |
| Backend | Next.js 16 (App Router) · Route Handlers |
| Frontend | React 19 · Tailwind CSS v4 · shadcn/ui (Base UI) |
| Tipado | TypeScript (strict) |

> El acceso a datos es **SQL directo sin ORM** a propósito: el proyecto necesita controlar transacciones, bloqueos y niveles de aislamiento de forma explícita.

## Modelo de datos

```mermaid
erDiagram
    aeropuertos ||--o{ vuelos : "origen"
    aeropuertos ||--o{ vuelos : "destino"
    vuelos      ||--o{ asientos : "tiene"
    vuelos      ||--o{ reservas : "de"
    asientos    ||--o| reservas : "ocupa"
    pasajeros   ||--o{ reservas : "hace"
    vuelos      ||--o{ lista_espera : "encola"
    pasajeros   ||--o{ lista_espera : "espera"
    operadores  ||--o{ sesiones : "abre"

    aeropuertos {
        text codigo PK
        text ciudad
        text pais
    }
    vuelos {
        int id PK
        text aerolinea
        text origen FK
        text destino FK
        timestamptz salida
        timestamptz llegada
        text estado
        int retraso_min
    }
    asientos {
        int id PK
        int vuelo_id FK
        text numero
        text clase
        text estado
    }
    pasajeros {
        int id PK
        text nombre
        text documento
    }
    reservas {
        int id PK
        int vuelo_id FK
        int asiento_id FK
        int pasajero_id FK
        text estado
        timestamptz fecha
    }
    lista_espera {
        int id PK
        int vuelo_id FK
        int pasajero_id FK
        int posicion
        timestamptz fecha
    }
    bitacora {
        int id PK
        text tabla
        text operacion
        int registro_id
        jsonb datos
        text usuario_bd
        timestamptz fecha
    }
    operadores {
        int id PK
        text username
        text password_hash
        text role
        bool activo
    }
    sesiones {
        uuid id PK
        int operador_id FK
        timestamptz expira_en
    }
```

### Relaciones (llaves foráneas)

| Tabla | Columna | Referencia |
|-------|---------|-----------|
| `vuelos` | `origen` | `aeropuertos(codigo)` |
| `vuelos` | `destino` | `aeropuertos(codigo)` |
| `asientos` | `vuelo_id` | `vuelos(id)` |
| `reservas` | `vuelo_id` | `vuelos(id)` |
| `reservas` | `asiento_id` | `asientos(id)` |
| `reservas` | `pasajero_id` | `pasajeros(id)` |
| `lista_espera` | `vuelo_id` | `vuelos(id)` |
| `lista_espera` | `pasajero_id` | `pasajeros(id)` |
| `sesiones` | `operador_id` | `operadores(id)` |

### Restricciones clave

- `asientos`: `UNIQUE (vuelo_id, numero)` — no hay dos asientos con el mismo número en un vuelo.
- `reservas`: `UNIQUE (vuelo_id, asiento_id)` — **anti doble-reserva**: un asiento se vende una sola vez.
- `pasajeros`: `documento` único.
- `operadores`: `username` único; `role` ∈ `{agente, admin, consulta}`.

## Estado

| Área | Estado |
|------|--------|
| Autenticación de operadores (login, sesiones en DB, roles) | ✅ Implementado |
| Modelo de datos del catálogo (`aeropuertos`, `aerolineas`, `vuelos`, `asientos`) | ✅ Implementado |
| Capa de UI (dashboard, vuelos, asientos, reservas, lista de espera, reportes, auditoría, esquema, laboratorio, DBA, usuarios) | ✅ Conectada a la base de datos real |
| Reservas con concurrencia (`SELECT ... FOR UPDATE`, anti doble-reserva) | ✅ Implementado |
| Funciones y triggers (auditoría automática, promoción de lista de espera) | ✅ Implementado |
| Lista de espera con promoción automática | ✅ Implementado |
| Laboratorio de concurrencia ejecutable (aislamiento, deadlocks, doble-reserva) | ✅ Implementado |
| Roles y permisos en ejecución (`SET LOCAL ROLE` por operador) | ✅ Implementado |
| Panel DBA (catálogos de sistema: tamaños, índices, uso) | ✅ Implementado |
| Auditoría — bitácora automática con detalle por registro | ✅ Implementado |
| Reportes y vistas de ocupación | ✅ Implementado |

> Todas las pantallas operativas leen y escriben contra PostgreSQL real. No quedan datos de ejemplo
> embebidos en el frontend; los datos provienen de los seeds y/o del importador de OpenFlights.

## Cómo correr

**Requisitos:** Node.js 20+, Docker (PostgreSQL 17).

```bash
# 1. Levantar PostgreSQL (contenedor postgres-dev, puerto 5432) y crear la base
docker exec -i postgres-dev psql -U postgres -c "CREATE DATABASE aeroreserva"

# 2. Configurar la conexión
#    Crear .env.local con:
#    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aeroreserva"

# 3. Instalar dependencias
npm install

# 4. Aplicar TODAS las migraciones en orden (el glob las ordena: 001 → 012; no existe 004)
for f in db/migrations/*.sql; do
  echo "Aplicando $f"
  docker exec -i postgres-dev psql -U postgres -d aeroreserva < "$f"
done

# 5. Seed de un operador admin de desarrollo (admin / admin123)
node --env-file=.env.local db/seed.mjs

# 6. Cargar el catálogo (aeropuertos, vuelos, asientos). Elegí UNA opción:
#    a) Catálogo de demo, pequeño e idempotente:
node --env-file=.env.local db/seed-catalog.mjs
#    b) Catálogo real desde OpenFlights (más grande; soporta escala):
#    node --env-file=.env.local db/import-openflights.mjs --vuelos=300 --asientos=150

# 7. Arrancar
npm run dev   # http://localhost:3000
```

### Seeds opcionales (datos de demo más ricos)

```bash
# Llenar la tabla `aerolineas` y vincular vuelos.aerolinea_codigo (OpenFlights)
node --env-file=.env.local db/backfill-aerolineas.mjs

# Ocupación y estados de vuelo variados para una demo realista (~25-30% ocupación)
node --env-file=.env.local db/seed-ruido.mjs
```

### Scripts de demostración / benchmark

```bash
node --env-file=.env.local db/demo-roles.mjs          # GRANT/REVOKE en acción por rol
node --env-file=.env.local db/stress-concurrency.mjs  # carga concurrente real (anti doble-reserva)
node --env-file=.env.local db/benchmark.mjs           # tiempos con/sin índice (EXPLAIN ANALYZE)
```

## Conceptos de administración de BD demostrados

- **Transacciones ACID** — reserva y cancelación atómicas.
- **Concurrencia** — bloqueos (`FOR UPDATE`), anti doble-reserva, lista de espera.
- **Niveles de aislamiento** — `READ COMMITTED` / `REPEATABLE READ` / `SERIALIZABLE` y sus anomalías.
- **Deadlocks** — detección y resolución automática del motor.
- **Programación en el motor** — funciones PL/pgSQL y triggers.
- **Auditoría** — bitácora automática vía triggers.
- **Seguridad** — roles y permisos (`GRANT`/`REVOKE`).
- **Integridad** — llaves foráneas, `UNIQUE`, `NOT NULL`, `CHECK`.
- **Optimización** — índices y `EXPLAIN ANALYZE`.
- **Vistas** — reportes de ocupación.
