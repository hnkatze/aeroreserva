import type { Metadata } from "next";
import Link from "next/link";
import { Plane, ArrowRight, Database } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Conceptos de base de datos — AeroReserva",
  description:
    "Guía educativa de los conceptos de bases de datos demostrados en AeroReserva: transacciones, locks, niveles de aislamiento, deadlocks, roles, índices y auditoría.",
};

// ── Concept card data ─────────────────────────────────────────────────────────

interface ConceptCard {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  summary: string;
  explanation: string;
  whyItMatters: string;
  inAction: { label: string; href: string };
}

const CONCEPTS: ConceptCard[] = [
  {
    id: "indices",
    title: "Índices",
    tag: "Rendimiento",
    tagColor:
      "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    summary:
      "Estructuras de datos auxiliares que permiten encontrar filas sin recorrer toda la tabla.",
    explanation:
      "Un índice en PostgreSQL es como el índice de un libro: en lugar de leer cada página para encontrar un término, vas directo a la entrada y obtenés la ubicación. Se crean automáticamente para PRIMARY KEY y columnas UNIQUE, y podés agregarlos manualmente en columnas de alta frecuencia de búsqueda. En AeroReserva los índices cubren campos como vuelo_id en asientos, creado_en en bitácora y tabla en bitácora — exactamente las columnas que las consultas filtran con mayor frecuencia.",
    whyItMatters:
      "Sin índices, cada consulta hace un sequential scan: lee todas las filas de la tabla. Con índices la base salta directamente al bloque correcto en disco. La diferencia entre un index scan y un seq scan puede ser de órdenes de magnitud en tablas grandes.",
    inAction: {
      label: "Ver índices y estadísticas de uso en /dba",
      href: "/dba",
    },
  },
  {
    id: "queries",
    title: "Consultas SQL y JOINs",
    tag: "Fundamentos",
    tagColor:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    summary:
      "El lenguaje para pedir datos a la base: SELECT, FROM, WHERE, JOIN y filtros dinámicos con parámetros.",
    explanation:
      "Cada pantalla de AeroReserva ejecuta consultas SQL construidas en el servidor. El listado de vuelos hace tres LEFT JOINs en un solo SELECT: vuelos → aerolineas → aeropuertos (origen) → aeropuertos (destino), resolviendo nombres a partir de códigos IATA. Los filtros de búsqueda (origen, destino, fecha, texto libre) se convierten en cláusulas WHERE con parámetros $1, $2, … — nunca concatenación de strings — para evitar inyección SQL.",
    whyItMatters:
      "Los JOINs son la forma de combinar tablas relacionadas sin duplicar datos. La parametrización de consultas es la primera línea de defensa contra SQL injection.",
    inAction: {
      label: "Ver consultas con JOINs en /vuelos",
      href: "/vuelos",
    },
  },
  {
    id: "transacciones",
    title: "Transacciones (BEGIN / COMMIT / ROLLBACK)",
    tag: "Atomicidad",
    tagColor:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    summary:
      "Un grupo de operaciones que se ejecutan como una unidad indivisible: todas ocurren, o ninguna.",
    explanation:
      "La función withTransaction() en src/lib/db.ts envuelve cualquier unidad de trabajo en BEGIN … COMMIT. Si cualquier instrucción dentro del bloque lanza un error, se ejecuta ROLLBACK automáticamente y la base queda exactamente como estaba antes. Esto garantiza atomicidad: una reserva inserta en reservas, actualiza el estado del asiento en asientos y registra en bitácora — todo dentro de la misma transacción, o nada.",
    whyItMatters:
      "Sin transacciones, un fallo a mitad de camino dejaría el sistema en un estado inconsistente: el asiento marcado como ocupado pero sin reserva, o viceversa. Las transacciones son la propiedad A de ACID.",
    inAction: {
      label: "Ver flujo de reservas (usa withTransaction) en /reservas",
      href: "/reservas",
    },
  },
  {
    id: "select-for-update",
    title: "SELECT … FOR UPDATE (lock pesimista)",
    tag: "Concurrencia",
    tagColor:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    summary:
      "Bloqueo de filas dentro de una transacción para que ninguna otra transacción pueda modificarlas hasta el COMMIT.",
    explanation:
      "En el laboratorio, dos transacciones (T1 y T2) intentan reservar el mismo asiento al mismo tiempo. T1 ejecuta SELECT id, estado FROM asientos WHERE id = $1 FOR UPDATE y adquiere el lock de fila. T2 intenta la misma consulta y se bloquea — espera. Cuando T1 hace COMMIT y libera el lock, T2 se desbloquea, re-lee el estado del asiento, ve que ya está 'ocupado' y hace ROLLBACK. El asiento se vendió exactamente una vez.",
    whyItMatters:
      "Sin FOR UPDATE, T1 y T2 podrían leer el mismo estado 'libre' simultáneamente y ambas confirmar una reserva — el temido double booking. El lock pesimista serializa el acceso a la fila crítica.",
    inAction: {
      label: "Ver el experimento en vivo en /laboratorio",
      href: "/laboratorio",
    },
  },
  {
    id: "aislamiento",
    title: "Niveles de aislamiento",
    tag: "Consistencia",
    tagColor:
      "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    summary:
      "Cuánto protege PostgreSQL a una transacción de ver cambios que hacen otras transacciones concurrentes.",
    explanation:
      "El laboratorio demuestra dos niveles. Con READ COMMITTED (el nivel por defecto), T1 hace una primera lectura de un asiento, T2 actualiza y hace COMMIT, y T1 hace una segunda lectura: ve el nuevo valor — anomalía de 'lectura no repetible'. Con REPEATABLE READ, T1 trabaja sobre un snapshot tomado al inicio de su transacción: la segunda lectura devuelve el valor original aunque T2 ya haya comiteado. El nivel Serializable va un paso más y previene incluso anomalías de phantom reads.",
    whyItMatters:
      "Elegir el nivel correcto depende del contrato de consistencia requerido. READ COMMITTED es eficiente pero puede mostrar datos cambiantes. REPEATABLE READ y SERIALIZABLE dan más garantías a costo de mayor contención.",
    inAction: {
      label: "Ver la demostración interactiva en /laboratorio",
      href: "/laboratorio",
    },
  },
  {
    id: "deadlock",
    title: "Deadlocks",
    tag: "Concurrencia",
    tagColor:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    summary:
      "Situación donde dos transacciones se esperan mutuamente y ninguna puede avanzar — PostgreSQL la detecta y aborta una.",
    explanation:
      "El escenario de deadlock en el laboratorio orquesta deliberadamente un ciclo: T1 bloquea el asiento S1 y espera S2; T2 bloquea S2 y espera S1. PostgreSQL detecta el ciclo de dependencias con su deadlock detector y aborta una de las dos transacciones con SQLSTATE 40P01 (deadlock detected). La transacción elegida como víctima hace ROLLBACK automático. La solución de producción es siempre adquirir locks en el mismo orden canónico (ORDER BY id ASC) para que el ciclo nunca se forme.",
    whyItMatters:
      "Los deadlocks no son bugs en el código de la aplicación — son una propiedad del modelo relacional con locks. El sistema de detección de PostgreSQL los resuelve automáticamente, pero la aplicación debe estar preparada para reintentar la transacción abortada.",
    inAction: {
      label: "Ver el deadlock en acción en /laboratorio",
      href: "/laboratorio",
    },
  },
  {
    id: "roles",
    title: "Roles y permisos de PostgreSQL",
    tag: "Seguridad",
    tagColor:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    summary:
      "Roles NOLOGIN con conjuntos distintos de GRANTs, activados por transacción con SET LOCAL ROLE.",
    explanation:
      "La migración 006_roles.sql define tres roles sin login: app_consulta (solo SELECT en tablas de negocio), app_agente (SELECT + INSERT/UPDATE en reservas y asientos) y app_admin (ALL en todas las tablas). Al iniciar cada transacción, withTransaction() ejecuta SET LOCAL ROLE \"app_agente\" (o el rol correspondiente al operador logueado), lo que significa que todas las instrucciones dentro de esa transacción corren con los privilegios de ese rol — y se resetean al COMMIT o ROLLBACK. Así un agente nunca puede borrar registros aunque lo intente.",
    whyItMatters:
      "El principio de mínimo privilegio: cada operación solo tiene los permisos que necesita, nada más. Los roles de PostgreSQL son la implementación de ese principio a nivel de motor — independiente de lo que haga el código de la aplicación.",
    inAction: {
      label: "Ver los operadores y sus roles en /usuarios",
      href: "/usuarios",
    },
  },
  {
    id: "auditoria",
    title: "Auditoría con triggers",
    tag: "Integridad",
    tagColor:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    summary:
      "Función PL/pgSQL con SECURITY DEFINER que registra automáticamente todo INSERT, UPDATE y DELETE en la tabla bitacora.",
    explanation:
      "La migración 007_bitacora.sql crea la función registrar_bitacora() y la adjunta como trigger AFTER INSERT OR UPDATE OR DELETE en las tablas reservas, asientos y pasajeros. El trigger usa to_jsonb(OLD) / to_jsonb(NEW) para capturar el estado completo de la fila antes y después del cambio, lee el operador de la sesión vía current_setting('app.current_operator', true), y hace INSERT en bitacora. SECURITY DEFINER es clave: permite que roles limitados como app_agente (que no tiene INSERT en bitácora) registren igualmente sus acciones.",
    whyItMatters:
      "La auditoría a nivel de base de datos es incorruptible desde la capa de aplicación: aunque un bug en el código omita el registro, el trigger lo captura de todas formas. Ninguna acción en las tablas auditadas puede escapar al log.",
    inAction: {
      label: "Ver el log completo de auditoría en /auditoria",
      href: "/auditoria",
    },
  },
];

// ── Page component ────────────────────────────────────────────────────────────

export default function ConceptosPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <nav aria-label="Navegación principal" className="mb-6 flex items-center justify-between">
            <Link
              href="/login"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plane className="h-4 w-4" aria-hidden="true" />
              <span>AeroReserva</span>
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
              )}
            >
              Ingresar al sistema
            </Link>
          </nav>

          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary"
              aria-hidden="true"
            >
              <Database className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Conceptos de base de datos
              </h1>
              <p className="mt-2 max-w-2xl text-base text-muted-foreground">
                AeroReserva es un sistema real de gestión de reservas aéreas construido para
                demostrar conceptos avanzados de bases de datos relacionales con PostgreSQL 17.
                Cada concepto de esta guía está implementado en el código del proyecto y
                visible en el sistema.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Concept grid ────────────────────────────────────────────────── */}
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <ol className="flex flex-col gap-6" aria-label="Conceptos de base de datos">
          {CONCEPTS.map((concept, index) => (
            <li key={concept.id}>
              <article
                id={concept.id}
                aria-labelledby={`${concept.id}-title`}
                className="rounded-xl border border-border bg-card p-6 sm:p-8"
              >
                {/* Card header */}
                <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <h2
                      id={`${concept.id}-title`}
                      className="font-heading text-xl font-semibold text-foreground"
                    >
                      {concept.title}
                    </h2>
                  </div>
                  <span
                    className={cn(
                      "self-start rounded-full px-3 py-1 text-xs font-medium",
                      concept.tagColor,
                    )}
                  >
                    {concept.tag}
                  </span>
                </header>

                {/* Summary */}
                <p className="mb-4 text-base font-medium text-foreground">
                  {concept.summary}
                </p>

                {/* Explanation */}
                <section aria-label={`Explicación: ${concept.title}`}>
                  <h3 className="sr-only">Explicación</h3>
                  <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                    {concept.explanation}
                  </p>
                </section>

                {/* Why it matters */}
                <section aria-label={`Por qué importa: ${concept.title}`}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Por qué importa
                  </h3>
                  <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                    {concept.whyItMatters}
                  </p>
                </section>

                {/* In action link */}
                <div>
                  <Link
                    href={concept.inAction.href}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "gap-1.5",
                    )}
                  >
                    {concept.inAction.label}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Requiere iniciar sesión como operador.
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ol>

        {/* ── Footer CTA ────────────────────────────────────────────────── */}
        <section
          aria-labelledby="cta-heading"
          className="mt-10 rounded-xl border border-border bg-muted/50 p-8 text-center"
        >
          <h2
            id="cta-heading"
            className="font-heading text-xl font-semibold text-foreground"
          >
            ¿Querés verlo en acción?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Todos los conceptos de esta guía están implementados en el sistema. Ingresá
            con un usuario de operador para explorarlos interactivamente.
          </p>
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "lg" }), "mt-4")}
          >
            Ingresar al sistema
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </main>
    </div>
  );
}
