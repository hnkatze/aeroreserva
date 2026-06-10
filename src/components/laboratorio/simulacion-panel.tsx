"use client"

import * as React from "react"
import { toast } from "sonner"
import { PlayIcon, GitBranchIcon, ShieldAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"

// ── Types ─────────────────────────────────────────────────────────────────────

type StepStatus = "pendiente" | "ejecutando" | "ok" | "bloqueada" | "abortada"
type IsolationLevel = "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE"
type Scenario = "doble-reserva" | "deadlock"

interface SqlStep {
  sql: string
  status: StepStatus
}

interface TransactionState {
  steps: SqlStep[]
  outcome: "commit" | "rollback" | "deadlock" | "pending"
}

interface SimulationResult {
  txA: TransactionState
  txB: TransactionState
  summary: string
  verdict: "ok" | "warn" | "error"
}

// ── MOCK DATA ─────────────────────────────────────────────────────────────────
// Each scenario × isolation level returns static SQL steps + explanation.
// Real execution would go through an API route + pg transaction management.

const MOCK_SIMULATIONS: Record<IsolationLevel, Record<Scenario, SimulationResult>> = {
  "READ COMMITTED": {
    "doble-reserva": {
      txA: {
        steps: [
          { sql: "BEGIN;", status: "ok" },
          { sql: "SELECT * FROM asientos WHERE id = '14A' FOR UPDATE;", status: "ok" },
          { sql: "-- asiento 14A disponible → ok", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '14A';", status: "ok" },
          { sql: "COMMIT;", status: "ok" },
        ],
        outcome: "commit",
      },
      txB: {
        steps: [
          { sql: "BEGIN;", status: "ok" },
          { sql: "SELECT * FROM asientos WHERE id = '14A' FOR UPDATE;", status: "bloqueada" },
          { sql: "-- bloqueada esperando a Txn A...", status: "bloqueada" },
          { sql: "-- Txn A comiteó → se desbloquea", status: "ok" },
          { sql: "-- asiento 14A ya es 'ocupado' → ROLLBACK", status: "abortada" },
          { sql: "ROLLBACK;", status: "abortada" },
        ],
        outcome: "rollback",
      },
      summary:
        "El FOR UPDATE bloqueó el asiento hasta que Txn A terminara. Cuando B leyó, ya estaba ocupado. El asiento 14A se vendió una sola vez. READ COMMITTED protege en este caso gracias al lock explícito.",
      verdict: "ok",
    },
    "deadlock": {
      txA: {
        steps: [
          { sql: "BEGIN;", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '14A';", status: "ok" },
          { sql: "-- intentando lock sobre 15B...", status: "bloqueada" },
          { sql: "-- deadlock detectado → PostgreSQL aborta Txn A", status: "abortada" },
          { sql: "ROLLBACK; -- ERROR: deadlock detected", status: "abortada" },
        ],
        outcome: "deadlock",
      },
      txB: {
        steps: [
          { sql: "BEGIN;", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '15B';", status: "ok" },
          { sql: "-- intentando lock sobre 14A...", status: "bloqueada" },
          { sql: "-- PostgreSQL elige víctima → Txn A abortada", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '14A';", status: "ok" },
          { sql: "COMMIT;", status: "ok" },
        ],
        outcome: "commit",
      },
      summary:
        "Txn A tenía lock en 14A y esperaba 15B. Txn B tenía lock en 15B y esperaba 14A. PostgreSQL detectó el ciclo y abortó la víctima (Txn A). Txn B continuó y comiteó.",
      verdict: "error",
    },
  },
  "REPEATABLE READ": {
    "doble-reserva": {
      txA: {
        steps: [
          { sql: "BEGIN ISOLATION LEVEL REPEATABLE READ;", status: "ok" },
          { sql: "SELECT * FROM asientos WHERE id = '14A';", status: "ok" },
          { sql: "-- snapshot tomado al inicio de la transacción", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '14A';", status: "ok" },
          { sql: "COMMIT;", status: "ok" },
        ],
        outcome: "commit",
      },
      txB: {
        steps: [
          { sql: "BEGIN ISOLATION LEVEL REPEATABLE READ;", status: "ok" },
          { sql: "SELECT * FROM asientos WHERE id = '14A';", status: "ok" },
          { sql: "-- snapshot: asiento aparece libre (tomado antes de A)", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '14A';", status: "bloqueada" },
          { sql: "-- serialization failure: txn A ya modificó la fila", status: "abortada" },
          { sql: "ROLLBACK; -- ERROR: could not serialize access", status: "abortada" },
        ],
        outcome: "rollback",
      },
      summary:
        "REPEATABLE READ garantiza que la fila no cambia durante la lectura dentro de la misma transacción. Al intentar el UPDATE, PostgreSQL detectó que la fila fue modificada por otra transacción concurrente y abortó Txn B. El asiento se vendió una sola vez.",
      verdict: "ok",
    },
    "deadlock": {
      txA: {
        steps: [
          { sql: "BEGIN ISOLATION LEVEL REPEATABLE READ;", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '14A';", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '15B';", status: "bloqueada" },
          { sql: "-- deadlock → Txn A elegida víctima", status: "abortada" },
          { sql: "ROLLBACK;", status: "abortada" },
        ],
        outcome: "deadlock",
      },
      txB: {
        steps: [
          { sql: "BEGIN ISOLATION LEVEL REPEATABLE READ;", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '15B';", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '14A';", status: "bloqueada" },
          { sql: "-- PostgreSQL resuelve el deadlock → B continúa", status: "ok" },
          { sql: "COMMIT;", status: "ok" },
        ],
        outcome: "commit",
      },
      summary:
        "El nivel REPEATABLE READ no cambia el comportamiento ante deadlocks: el ciclo de locks se forma igual. PostgreSQL lo resuelve abortando una de las transacciones. El orden de adquisición de locks es la raíz del problema.",
      verdict: "error",
    },
  },
  "SERIALIZABLE": {
    "doble-reserva": {
      txA: {
        steps: [
          { sql: "BEGIN ISOLATION LEVEL SERIALIZABLE;", status: "ok" },
          { sql: "SELECT * FROM asientos WHERE id = '14A';", status: "ok" },
          { sql: "-- SSI: registra dependencia de lectura sobre 14A", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '14A';", status: "ok" },
          { sql: "COMMIT;", status: "ok" },
        ],
        outcome: "commit",
      },
      txB: {
        steps: [
          { sql: "BEGIN ISOLATION LEVEL SERIALIZABLE;", status: "ok" },
          { sql: "SELECT * FROM asientos WHERE id = '14A';", status: "ok" },
          { sql: "-- SSI detecta dependencia rw conflictiva con Txn A", status: "bloqueada" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '14A';", status: "abortada" },
          { sql: "ROLLBACK; -- ERROR: could not serialize (rw-anti-dependency)", status: "abortada" },
        ],
        outcome: "rollback",
      },
      summary:
        "SERIALIZABLE usa SSI (Serializable Snapshot Isolation). PostgreSQL detectó una dependencia rw-anti-dependency entre Txn A y Txn B. Garantiza que el resultado es equivalente a una ejecución serial. Solo Txn A comiteó. Máxima protección, mayor overhead.",
      verdict: "ok",
    },
    "deadlock": {
      txA: {
        steps: [
          { sql: "BEGIN ISOLATION LEVEL SERIALIZABLE;", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '14A';", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '15B';", status: "bloqueada" },
          { sql: "-- deadlock: SSI no elimina locks reales", status: "abortada" },
          { sql: "ROLLBACK;", status: "abortada" },
        ],
        outcome: "deadlock",
      },
      txB: {
        steps: [
          { sql: "BEGIN ISOLATION LEVEL SERIALIZABLE;", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '15B';", status: "ok" },
          { sql: "UPDATE asientos SET estado = 'ocupado' WHERE id = '14A';", status: "bloqueada" },
          { sql: "-- Txn A abortada → B adquiere lock y continúa", status: "ok" },
          { sql: "COMMIT;", status: "ok" },
        ],
        outcome: "commit",
      },
      summary:
        "Incluso en SERIALIZABLE, los deadlocks ocurren cuando las transacciones adquieren locks en orden inverso. SSI agrega detección de anomalías de serialización, pero no elimina los deadlocks de row-level locks. La solución es ordenar los locks consistentemente.",
      verdict: "error",
    },
  },
}

// ── Step status helpers ───────────────────────────────────────────────────────

const STATUS_LABEL: Record<StepStatus, string> = {
  pendiente: "Pendiente",
  ejecutando: "Ejecutando",
  ok: "OK",
  bloqueada: "Bloqueada",
  abortada: "Abortada",
}

const STATUS_DOT: Record<StepStatus, string> = {
  pendiente: "bg-slate-500",
  ejecutando: "bg-amber-400 animate-pulse",
  ok: "bg-emerald-400",
  bloqueada: "bg-amber-400",
  abortada: "bg-red-500",
}

const STATUS_TEXT: Record<StepStatus, string> = {
  pendiente: "text-slate-400",
  ejecutando: "text-amber-300",
  ok: "text-slate-100",
  bloqueada: "text-amber-300",
  abortada: "text-red-400",
}

const OUTCOME_BADGE: Record<
  TransactionState["outcome"],
  { label: string; className: string }
> = {
  commit: {
    label: "COMMIT",
    className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  rollback: {
    label: "ROLLBACK",
    className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  deadlock: {
    label: "DEADLOCK",
    className: "bg-red-500/20 text-red-300 border-red-500/30",
  },
  pending: {
    label: "PENDIENTE",
    className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
}

const VERDICT_STYLES: Record<
  SimulationResult["verdict"],
  { badge: string; text: string }
> = {
  ok: {
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    text: "text-emerald-300",
  },
  warn: {
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    text: "text-amber-300",
  },
  error: {
    badge: "bg-red-500/20 text-red-300 border-red-500/30",
    text: "text-red-300",
  },
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface TransactionPanelProps {
  label: string
  txState: TransactionState
  visibleCount: number
}

function TransactionPanel({ label, txState, visibleCount }: TransactionPanelProps) {
  const outcomeBadge = OUTCOME_BADGE[txState.outcome]

  return (
    <article
      className="flex flex-col overflow-hidden rounded-xl border border-primary/30 bg-[#0f1b3a]"
      aria-label={`Panel de ${label}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-primary/20 px-4 py-3">
        <h3 className="font-mono text-sm font-semibold text-slate-100">
          {label}
        </h3>
        {visibleCount === txState.steps.length && txState.outcome !== "pending" && (
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-medium",
              outcomeBadge.className
            )}
          >
            {outcomeBadge.label}
          </span>
        )}
      </div>

      {/* SQL steps */}
      <ol className="flex flex-col gap-0 px-4 py-3" aria-label={`Pasos de ${label}`}>
        {txState.steps.slice(0, visibleCount).map((step, i) => (
          <li key={i} className="flex items-start gap-2.5 py-1.5">
            {/* Status dot */}
            <span
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                STATUS_DOT[step.status]
              )}
              aria-hidden="true"
            />
            {/* SQL line */}
            <code
              className={cn(
                "flex-1 font-mono text-xs leading-relaxed",
                STATUS_TEXT[step.status]
              )}
            >
              {step.sql}
            </code>
            {/* Inline status badge */}
            <span
              className={cn(
                "shrink-0 self-start rounded px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none",
                step.status === "ok" && "bg-emerald-500/10 text-emerald-400",
                step.status === "bloqueada" && "bg-amber-500/10 text-amber-400",
                step.status === "abortada" && "bg-red-500/10 text-red-400",
                step.status === "ejecutando" && "bg-amber-500/10 text-amber-400",
                step.status === "pendiente" && "bg-slate-500/10 text-slate-400",
              )}
              aria-label={`Estado: ${STATUS_LABEL[step.status]}`}
            >
              {STATUS_LABEL[step.status]}
            </span>
          </li>
        ))}
      </ol>
    </article>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SimulacionPanel() {
  const [level, setLevel] = React.useState<IsolationLevel>("READ COMMITTED")
  const [scenario, setScenario] = React.useState<Scenario>("doble-reserva")
  const [running, setRunning] = React.useState(false)
  const [result, setResult] = React.useState<SimulationResult | null>(null)
  const [visibleA, setVisibleA] = React.useState(0)
  const [visibleB, setVisibleB] = React.useState(0)

  function resetSimulation() {
    setResult(null)
    setVisibleA(0)
    setVisibleB(0)
  }

  async function runSimulation() {
    resetSimulation()
    setRunning(true)

    const sim = MOCK_SIMULATIONS[level][scenario] // MOCK

    const maxSteps = Math.max(sim.txA.steps.length, sim.txB.steps.length)

    // Reveal steps one by one with delay, alternating A and B
    for (let i = 0; i <= maxSteps; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 420))
      setVisibleA(Math.min(i + 1, sim.txA.steps.length))
      await new Promise<void>((resolve) => setTimeout(resolve, 260))
      setVisibleB(Math.min(i + 1, sim.txB.steps.length))
    }

    setResult(sim)
    setRunning(false)

    if (sim.txB.outcome === "rollback" || sim.txB.outcome === "deadlock") {
      toast.success("Simulación completada — conflicto resuelto por PostgreSQL")
    } else {
      toast.warning("Simulación completada — revisá el panel de resultado")
    }
  }

  const currentSim = result ?? MOCK_SIMULATIONS[level][scenario]

  return (
    <div className="flex flex-col gap-6">
      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <section aria-label="Controles de simulación">
        <div className="flex flex-wrap items-end gap-4">
          {/* Isolation level */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ctrl-isolation" className="text-sm text-muted-foreground">
              Nivel de aislamiento
            </Label>
            <Select
              value={level}
              onValueChange={(v) => {
                setLevel((v ?? "READ COMMITTED") as IsolationLevel)
                resetSimulation()
              }}
              disabled={running}
            >
              <SelectTrigger
                id="ctrl-isolation"
                className="w-52 font-mono text-xs"
                aria-label="Nivel de aislamiento de PostgreSQL"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="READ COMMITTED" className="font-mono text-xs">
                  READ COMMITTED
                </SelectItem>
                <SelectItem value="REPEATABLE READ" className="font-mono text-xs">
                  REPEATABLE READ
                </SelectItem>
                <SelectItem value="SERIALIZABLE" className="font-mono text-xs">
                  SERIALIZABLE
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scenario */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ctrl-scenario" className="text-sm text-muted-foreground">
              Escenario
            </Label>
            <Select
              value={scenario}
              onValueChange={(v) => {
                setScenario((v ?? "doble-reserva") as Scenario)
                resetSimulation()
              }}
              disabled={running}
            >
              <SelectTrigger
                id="ctrl-scenario"
                className="w-48"
                aria-label="Escenario de concurrencia a simular"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="doble-reserva">
                  <GitBranchIcon className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
                  Doble reserva
                </SelectItem>
                <SelectItem value="deadlock">
                  <ShieldAlertIcon className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
                  Deadlock
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Run button */}
          <Button
            onClick={runSimulation}
            disabled={running}
            className="h-8 gap-2 bg-primary text-primary-foreground hover:bg-primary/80"
            aria-label="Ejecutar simulación de concurrencia"
          >
            <PlayIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {running ? "Ejecutando…" : "Ejecutar simulación"}
          </Button>
        </div>
      </section>

      {/* ── Transaction panels ─────────────────────────────────────────────── */}
      <section aria-label="Transacciones concurrentes">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TransactionPanel
            label="Transacción A"
            txState={currentSim.txA}
            visibleCount={result ? currentSim.txA.steps.length : visibleA}
          />
          <TransactionPanel
            label="Transacción B"
            txState={currentSim.txB}
            visibleCount={result ? currentSim.txB.steps.length : visibleB}
          />
        </div>
      </section>

      {/* ── Result panel ───────────────────────────────────────────────────── */}
      <section
        aria-label="Resultado de la simulación"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="rounded-xl border border-primary/20 bg-[#0f1b3a] p-5">
          <div className="mb-3 flex items-center gap-3">
            <h3 className="font-heading text-sm font-semibold text-slate-200">
              Resultado
            </h3>
            {result && (
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-medium",
                  VERDICT_STYLES[result.verdict].badge
                )}
              >
                {result.verdict === "ok"
                  ? "Consistencia garantizada"
                  : result.verdict === "error"
                  ? "Deadlock detectado"
                  : "Atención"}
              </span>
            )}
          </div>

          {result ? (
            <p
              className={cn(
                "font-mono text-xs leading-relaxed",
                VERDICT_STYLES[result.verdict].text
              )}
            >
              {result.summary}
            </p>
          ) : (
            <p className="font-mono text-xs text-slate-500">
              Seleccioná un nivel de aislamiento y un escenario, luego presioná{" "}
              <span className="text-slate-400">Ejecutar simulación</span> para ver los pasos.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
