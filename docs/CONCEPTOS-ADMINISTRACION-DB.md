# AeroReserva — El valor del proyecto y los conceptos de Administración de Bases de Datos

> Documento de sustento académico. Explica **qué hace** el sistema, cuál es su **diferencial (el "plus")**
> y, sobre todo, **qué conceptos de Administración de Bases de Datos** se aplican y **dónde verlos**.

---

## 1. La idea en una frase

**AeroReserva** es un sistema de reservas de vuelos cuyo valor **no está en la interfaz, sino en la base de datos**.
La aplicación web es deliberadamente un *cliente delgado* sobre **PostgreSQL**: existe para *demostrar* el manejo
profesional del motor — concurrencia, integridad, auditoría, optimización, seguridad y roles — no para lucir pantallas.

Esto es **Administración de Bases de Datos**, no un CRUD: las garantías críticas (que un asiento no se reserve dos
veces, que cada cambio quede auditado, que cada rol pueda hacer solo lo suyo) viven **dentro del motor**, no en el código de la app.

---

## 2. Decisiones de diseño que sostienen el "plus"

| Decisión | Por qué importa para Administración de DB |
|---|---|
| **PostgreSQL sin ORM** (se usa `pg` con SQL explícito) | Un ORM esconde el `SELECT ... FOR UPDATE`, los niveles de aislamiento y las transacciones. Al escribir SQL a mano, esos mecanismos quedan **visibles y demostrables**. |
| **Lógica crítica en el motor** (triggers + funciones PL/pgSQL) | La integridad de procesos (auditoría, promoción de lista de espera) no depende de que la app "se acuerde" de hacerla: el motor la garantiza. |
| **Volumen de datos real** | No es una base de juguete. Las garantías se prueban a escala. |

### Volumen actual de la base

| Tabla | Filas | Rol en la demostración |
|---|---:|---|
| `asientos` | **1,000,050** | Tabla masiva — ideal para mostrar índices y bloqueo de filas |
| `reservas` | **428,586** | Tabla "caliente" de concurrencia |
| `bitacora` | **18,062** | Auditoría ya poblada por los triggers |
| `pasajeros` | 9,354 | Búsqueda y upsert |
| `vuelos` | 6,667 | Catálogo operativo |
| `aeropuertos` | 6,071 | Catálogo (datos OurAirports) |
| `aerolineas` | 5 | Catálogo |

---

## 3. Conceptos de Administración de DB aplicados

Para cada concepto: **qué es**, **dónde está en el proyecto** y **por qué importa**.

### 3.1 Transacciones ACID explícitas
- **Qué:** operaciones compuestas que ocurren **todo o nada** (`BEGIN` → … → `COMMIT`, o `ROLLBACK` ante error).
- **Dónde:** `src/lib/db.ts` → helper `withTransaction()`. Lo usa `crearReserva()` para encadenar de forma atómica:
  *upsert del pasajero → bloqueo del asiento → INSERT de la reserva → UPDATE del asiento*. Si cualquier paso falla, **nada** queda a medias.
- **Por qué:** garantiza **atomicidad y consistencia** — el sistema nunca queda en un estado intermedio inválido.

### 3.2 Control de concurrencia — bloqueo pesimista (`SELECT ... FOR UPDATE`)
- **Qué:** bloquear la fila del asiento **antes** de validar e insertar, para que dos operadores no la tomen a la vez.
- **Dónde:** `src/lib/reservas.ts` → `crearReserva()`:
  ```sql
  SELECT id FROM asientos WHERE id = $1 AND vuelo_id = $2 FOR UPDATE;
  ```
- **Por qué:** elimina la condición de carrera **TOCTOU** (*time-of-check to time-of-use*): entre "verifico que está libre" y
  "lo reservo", nadie más puede colarse.

### 3.3 Concurrencia sin contención (`FOR UPDATE SKIP LOCKED`)
- **Qué:** tomar "el siguiente disponible" de una cola **saltando** las filas que otra transacción ya bloqueó, en vez de esperar.
- **Dónde:** función `promover_lista_espera()` (PL/pgSQL) al elegir al próximo pasajero en espera.
- **Por qué:** patrón de **colas de trabajo de alta concurrencia** — varios procesos consumen la cola en paralelo sin pisarse ni bloquearse.

### 3.4 Garantía de unicidad bajo carrera (defensa en profundidad)
- **Qué:** aunque el bloqueo fallara, el **motor** rechaza un asiento duplicado.
- **Dónde:** índice único `ux_reservas_vuelo_asiento` sobre `(vuelo_id, asiento_id)`. El código captura el error
  PostgreSQL **`23505`** (unique_violation) y responde HTTP **409** (`AsientoOcupadoError`).
- **Por qué:** dos líneas de defensa — bloqueo de fila *y* restricción de unicidad. La integridad **no depende solo de la app**.

### 3.5 Niveles de aislamiento y deadlocks
- **Qué:** comportamiento de las transacciones según `READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`, y el caso de **interbloqueo (deadlock)**.
- **Dónde:** vista interactiva **`/laboratorio`**, que ilustra visualmente doble reserva, niveles de aislamiento y deadlocks.
- **Por qué:** muestra el *trade-off* entre consistencia y rendimiento que todo administrador debe entender.

### 3.6 Integridad referencial y restricciones declarativas
- **Qué:** el esquema **no permite** estados inválidos.
- **Dónde:** **11 claves foráneas** (p. ej. `reservas → vuelos / asientos / pasajeros / operadores`), `UNIQUE`
  (`pasajeros.documento`, `operadores.username`, `vuelos.codigo`, `lista_espera(vuelo, pasajero)`), `NOT NULL` y `DEFAULT`.
- **Por qué:** la integridad es **declarativa**, validada por el motor, no por validaciones dispersas en el código.

### 3.7 Auditoría mediante triggers (bitácora)
- **Qué:** registrar automáticamente **cada** INSERT/UPDATE/DELETE sobre las tablas sensibles.
- **Dónde:** función `registrar_bitacora()` + triggers `trg_audit_*` sobre `reservas`, `asientos` y `pasajeros`.
  Guarda el **antes** y el **después** como **JSONB** (`to_jsonb(OLD)` / `to_jsonb(NEW)`). Visible en **`/auditoria`**.
- **Por qué:** **trazabilidad total** — quién cambió qué, cuándo y con qué valores. Requisito clásico de administración y cumplimiento.

### 3.8 Propagación de identidad app → sesión de base de datos
- **Qué:** registrar **qué operador** hizo cada cambio, aun usando un *pool* de conexiones compartido.
- **Dónde:** antes de cada operación se ejecuta
  `SELECT set_config('app.current_operator', <id>, true)` (equivale a `SET LOCAL`, alcance de transacción), y el trigger
  lo lee con `current_setting('app.current_operator', true)`.
- **Por qué:** une la identidad de la aplicación con la auditoría del motor de forma **segura para concurrencia** (no se filtra entre transacciones).

### 3.9 Lógica de negocio dentro del motor (triggers + funciones PL/pgSQL)
- **Qué:** automatizar un proceso completo en la base de datos.
- **Dónde:** al cancelarse una reserva y liberarse el asiento, el trigger `trg_promover_espera` ejecuta
  `promover_lista_espera()`: toma al primer pasajero en espera, **crea su reserva**, ocupa el asiento y marca la entrada
  como *promovida* — **todo atómico, sin intervención de la app**. También `encolar_espera()`.
- **Por qué:** demuestra que reglas de negocio críticas pueden — y a veces deben — vivir en el motor para garantizar consistencia.

### 3.10 Seguridad: roles y privilegios
- **Roles de PostgreSQL reales:** `app_consulta`, `app_agente`, `app_admin`, con **GRANTs** diferenciados a nivel de motor
  (migración `006_roles.sql`). Un rol de solo consulta **no puede** insertar ni borrar — lo rechaza PostgreSQL (`42501 insufficient_privilege`), no la app.
- **`SECURITY DEFINER`** en las funciones: se ejecutan con los privilegios del propietario, controlando el acceso a operaciones sensibles.
- **Hashing de contraseñas:** `scrypt` + *salt* aleatorio y comparación en **tiempo constante** (`timingSafeEqual`) — `src/lib/password.ts`.
- **Sesiones del lado servidor:** tabla `sesiones` con expiración (`expira_en`) y *cookie* opaca `httpOnly`; el navegador nunca ve datos del operador (`src/lib/auth.ts`).

### 3.11 Optimización y rendimiento
- **Índices B-tree estratégicos:** `idx_reservas_vuelo`, `idx_asientos_vuelo`, `idx_vuelos_estado/salida/aerolinea`,
  `idx_bitacora_*`, `idx_sesiones_*`. Aceleran JOINs y filtros sobre tablas de cientos de miles / un millón de filas.
- **Consultas parametrizadas** (`$1, $2…`): previenen **inyección SQL** y favorecen el *caching* de planes.
- **Pool de conexiones** (`max: 10`): reutiliza conexiones en vez de abrir/cerrar en cada petición.
- **Paginación** (`LIMIT/OFFSET`) en los listados para no traer tablas enteras.

### 3.12 Vistas para análisis y reporting
- **Qué:** encapsular agregaciones complejas en objetos reutilizables.
- **Dónde:** `v_ocupacion_vuelo`, `v_ocupacion_ruta`, `v_ocupacion_aerolinea`, `v_retraso_aerolinea`,
  `v_top_aeropuertos`, `v_vuelos_por_estado`, `v_resumen_kpis`. Alimentan la vista **`/reportes`**.
- **Por qué:** separan la **capa analítica** de la operativa y simplifican el consumo de KPIs.

---

## 4. Scripts de demostración ejecutable (la evidencia más fuerte)

En `db/` hay scripts que **prueban en vivo** los conceptos. Se ejecutan con:
`node --env-file=.env.local db/<script>.mjs`

### 4.1 `stress-concurrency.mjs` — concurrencia bajo carga real
Replica exactamente la transacción de reserva y dispara muchas en paralelo:
- **Escenario A — contención total:** 30 agentes pelean por **el mismo** asiento → debe ganar **exactamente 1**.
- **Escenario B — throughput:** 200 reservas en asientos distintos en paralelo → mide **reservas/segundo**.
- **Escenario C — contención múltiple:** 10 asientos × 10 competidores → **un ganador por asiento**.
- **Verificación global de integridad:** consulta si existe algún asiento con **doble reserva confirmada** → resultado esperado: **CERO**.

> **Lo que demuestra:** el *anti-double-booking* (3.2 + 3.4) se sostiene **bajo carga concurrente real**, no solo en teoría.

### 4.2 `demo-roles.mjs` — control de acceso a nivel de motor
Bajo cada rol (`app_consulta`, `app_agente`, `app_admin`) intenta una batería de operaciones usando
`SET LOCAL ROLE` + `SAVEPOINT` por operación, y muestra una **matriz de permitido/denegado**:

| Operación | app_consulta | app_agente | app_admin |
|---|:--:|:--:|:--:|
| `SELECT` vuelos | ✅ | ✅ | ✅ |
| `SELECT` operadores | 🚫 | 🚫 | ✅ |
| `INSERT` pasajero | 🚫 | ✅ | ✅ |
| `UPDATE` asiento | 🚫 | ✅ | ✅ |
| `DELETE` vuelo | 🚫 | 🚫 | ✅ |

> **Lo que demuestra:** los privilegios los aplica **PostgreSQL** (`42501`), no la aplicación. Es seguridad real de base de datos (3.10).

### 4.3 `benchmark.mjs` — optimización medible
- Mide la **latencia** de las consultas reales de la app (listar vuelos, asientos libres, reservas con JOINs, `COUNT(*)`).
- Usa **`EXPLAIN (ANALYZE, BUFFERS)`** para detectar **Seq Scan vs Index Scan**.
- Demostración **antes/después**: crea un **índice parcial** `ON asientos(vuelo_id, id) WHERE estado='libre'`
  con `CREATE INDEX CONCURRENTLY`, vuelve a medir y reporta el **% de mejora**, luego lo elimina.

> **Lo que demuestra:** *tuning* de índices y lectura de planes de ejecución — el núcleo de la optimización de consultas (3.11).

---

## 5. Inventario del esquema

- **Tablas (10):** `aerolineas`, `aeropuertos`, `vuelos`, `asientos`, `pasajeros`, `reservas`, `lista_espera`,
  `operadores`, `sesiones`, `bitacora`.
- **Vistas (7):** las `v_*` de ocupación, retrasos, top de aeropuertos, estado de vuelos y resumen de KPIs.
- **Funciones (3):** `registrar_bitacora()`, `promover_lista_espera()`, `encolar_espera()`.
- **Triggers:** auditoría (`trg_audit_*`) sobre `reservas`, `asientos`, `pasajeros`; promoción (`trg_promover_espera`) sobre `asientos`.
- **Restricciones:** 11 claves foráneas, índices únicos (`ux_reservas_vuelo_asiento`, `uq_lista_espera_vuelo_pasajero`, etc.) e índices de rendimiento.

> El diagrama entidad-relación interactivo está disponible en la vista **`/esquema`**.

---

## 6. Guion sugerido para la demostración en vivo

1. **`/esquema`** — mostrar el modelo: tablas, relaciones, claves foráneas.
2. **`/vuelos` → "Ver asientos"** — reservar un asiento desde el mapa (transacción + `FOR UPDATE`).
3. **Doble reserva** — intentar reservar el **mismo** asiento en dos pestañas → una recibe **409 "asiento ocupado"** (3.2 + 3.4).
4. **`/auditoria`** — mostrar que cada cambio quedó registrado con su **antes/después** en JSONB (3.7) y **qué operador** lo hizo (3.8).
5. **Promoción automática** — encolar un pasajero en `/lista-espera`, cancelar una reserva confirmada de ese vuelo y mostrar
   cómo el **trigger** lo promueve solo (3.9).
6. **`/reportes`** — KPIs servidos por **vistas** (3.12).
7. **Terminal:** correr `db/stress-concurrency.mjs`, `db/demo-roles.mjs` y `db/benchmark.mjs` para evidenciar
   concurrencia, roles y optimización **medibles** (sección 4).

---

## 7. Por qué esto es Administración de Bases de Datos (y no solo una app)

Un CRUD típico delega todo a la aplicación y trata a la base como un simple almacén. Aquí es al revés:

- La **consistencia bajo concurrencia** la garantiza el motor (bloqueos + restricciones), comprobada **bajo carga**.
- La **auditoría** y la **promoción de lista de espera** son **triggers y funciones** dentro de PostgreSQL.
- La **seguridad** se aplica con **roles y privilegios del motor**, no con `if` en el código.
- El **rendimiento** se mide y se mejora con **índices y planes de ejecución** (`EXPLAIN ANALYZE`).
- Todo esto, sobre un **volumen real** (más de un millón de asientos, cientos de miles de reservas).

En resumen: el proyecto demuestra el dominio de los pilares de la administración de bases de datos —
**ACID, control de concurrencia, integridad, auditoría, seguridad por roles y optimización** — con evidencia
ejecutable y a escala.
