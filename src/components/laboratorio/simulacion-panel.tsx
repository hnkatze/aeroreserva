"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  PlayIcon,
  GitBranchIcon,
  ShieldAlertIcon,
  ZapIcon,
  FlaskConicalIcon,
  InfoIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { TimelineLab } from "@/components/laboratorio/timeline-lab"
import type { EventoLab, ResultadoLab } from "@/lib/laboratorio"

// ── Types ─────────────────────────────────────────────────────────────────────

type EscenarioKey = "doble-reserva" | "aislamiento" | "deadlock"

type RunState =
  | { status: "idle" }
  | { status: "running"; escenario: EscenarioKey }
  | { status: "success"; resultado: ResultadoLab }
  | { status: "error"; mensaje: string }

// ── Scenario metadata ─────────────────────────────────────────────────────────

interface ScenarioMeta {
  label: string
  description: string
  icon: React.ReactNode
}

const SCENARIO_META: Record<EscenarioKey, ScenarioMeta> = {
  "doble-reserva": {
    label: "Doble reserva",
    description:
      "Dos transacciones compiten por el mismo asiento. SELECT … FOR UPDATE serializa el acceso.",
    icon: <GitBranchIcon className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  "aislamiento": {
    label: "Niveles de aislamiento",
    description:
      "Lectura no repetible bajo READ COMMITTED vs REPEATABLE READ en el mismo asiento.",
    icon: <ZapIcon className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  "deadlock": {
    label: "Deadlock",
    description:
      "T1 bloquea S1→S2, T2 bloquea S2→S1. PostgreSQL detecta el ciclo y aborta una víctima.",
    icon: <ShieldAlertIcon className="h-3.5 w-3.5" aria-hidden="true" />,
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function runScenario(escenario: EscenarioKey): Promise<ResultadoLab> {
  const res = await fetch("/api/laboratorio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ escenario }),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  const body = (await res.json()) as { resultado: ResultadoLab }
  return body.resultado
}

// ── Summary stats ─────────────────────────────────────────────────────────────

interface StatsBarProps {
  eventos: EventoLab[]
  durationMs: number
}

function StatsBar({ eventos, durationMs }: StatsBarProps) {
  const byNivel = eventos.reduce<Record<string, number>>((acc, e) => {
    const n = e.nivel ?? "info"
    acc[n] = (acc[n] ?? 0) + 1
    return acc
  }, {})

  return (
    <dl
      className="flex flex-wrap gap-4 rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-xs"
      aria-label="Estadísticas del escenario"
    >
      <div className="flex items-center gap-1.5">
        <dt className="text-muted-foreground">Duración</dt>
        <dd className="font-mono font-semibold text-foreground">{durationMs}ms</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt className="text-muted-foreground">Eventos</dt>
        <dd className="font-mono font-semibold text-foreground">{eventos.length}</dd>
      </div>
      {byNivel["lock"] !== undefined && (
        <div className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">Bloqueos</dt>
          <dd className="font-mono font-semibold text-amber-700 dark:text-amber-400">{byNivel["lock"]}</dd>
        </div>
      )}
      {byNivel["error"] !== undefined && (
        <div className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">Errores/Aborts</dt>
          <dd className="font-mono font-semibold text-red-600 dark:text-red-400">{byNivel["error"]}</dd>
        </div>
      )}
      {byNivel["ok"] !== undefined && (
        <div className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">OK</dt>
          <dd className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{byNivel["ok"]}</dd>
        </div>
      )}
    </dl>
  )
}

// ── Conclusion panel ──────────────────────────────────────────────────────────

interface ConclusionPanelProps {
  resultado: ResultadoLab
  durationMs: number
}

function ConclusionPanel({ resultado, durationMs }: ConclusionPanelProps) {
  return (
    <section
      aria-label="Conclusión del escenario"
      aria-live="polite"
      aria-atomic="true"
      className="flex flex-col gap-3"
    >
      <StatsBar eventos={resultado.eventos} durationMs={durationMs} />

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <FlaskConicalIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          Conclusión
        </h3>
        <p className="font-mono text-xs leading-relaxed text-foreground">
          {resultado.conclusion}
        </p>
      </div>
    </section>
  )
}

// ── Disclaimer ────────────────────────────────────────────────────────────────

function Disclaimer() {
  return (
    <aside
      className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/30"
      aria-label="Aviso sobre ejecución real"
    >
      <InfoIcon
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400"
        aria-hidden="true"
      />
      <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
        Cada escenario ejecuta transacciones SQL reales contra la base de datos y limpia todo lo que modifica.
        El tiempo de ejecución depende de la latencia a Railway (~100–800ms).
      </p>
    </aside>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SimulacionPanel() {
  const [escenario, setEscenario] = React.useState<EscenarioKey>("doble-reserva")
  const [runState, setRunState] = React.useState<RunState>({ status: "idle" })
  const [durationMs, setDurationMs] = React.useState(0)

  const isRunning = runState.status === "running"

  async function handleRun(): Promise<void> {
    setRunState({ status: "running", escenario })
    const t0 = Date.now()

    try {
      const resultado = await runScenario(escenario)
      const elapsed = Date.now() - t0
      setDurationMs(elapsed)
      setRunState({ status: "success", resultado })
      toast.success(`Escenario completado en ${elapsed}ms`)
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : "Error desconocido ejecutando el escenario"
      setRunState({ status: "error", mensaje })
      toast.error(`Error: ${mensaje}`)
    }
  }

  function handleScenarioChange(v: string | null): void {
    setEscenario((v ?? "doble-reserva") as EscenarioKey)
    setRunState({ status: "idle" })
  }

  const meta = SCENARIO_META[escenario]

  return (
    <div className="flex flex-col gap-6">
      {/* ── Disclaimer ────────────────────────────────────────────────────── */}
      <Disclaimer />

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <section aria-label="Controles de laboratorio">
        <div className="flex flex-wrap items-end gap-4">
          {/* Scenario selector */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ctrl-escenario" className="text-sm text-muted-foreground">
              Escenario
            </Label>
            <Select
              value={escenario}
              onValueChange={handleScenarioChange}
              disabled={isRunning}
            >
              <SelectTrigger
                id="ctrl-escenario"
                className="w-56"
                aria-label="Seleccionar escenario de concurrencia"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SCENARIO_META) as EscenarioKey[]).map((key) => {
                  const m = SCENARIO_META[key]
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5">
                        {m.icon}
                        {m.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Run button */}
          <Button
            onClick={() => void handleRun()}
            disabled={isRunning}
            className="h-8 gap-2 bg-primary text-primary-foreground hover:bg-primary/80"
            aria-label={
              isRunning
                ? "Ejecutando escenario de laboratorio…"
                : `Ejecutar escenario: ${meta.label}`
            }
          >
            {isRunning ? (
              <>
                <span
                  className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
                Ejecutando…
              </>
            ) : (
              <>
                <PlayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Ejecutar en DB real
              </>
            )}
          </Button>
        </div>

        {/* Scenario description */}
        <p className="mt-2 text-xs text-muted-foreground">{meta.description}</p>
      </section>

      {/* ── Running indicator ─────────────────────────────────────────────── */}
      {runState.status === "running" && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
        >
          <span
            className="h-4 w-4 animate-spin motion-reduce:animate-none rounded-full border-2 border-primary border-t-transparent"
            aria-hidden="true"
          />
          <p className="text-sm text-primary">
            Ejecutando{" "}
            <strong>{SCENARIO_META[runState.escenario].label}</strong> contra la base de datos…
          </p>
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────────── */}
      {runState.status === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-950/20"
        >
          <h3 className="mb-1 text-sm font-semibold text-red-700 dark:text-red-300">
            Error ejecutando el escenario
          </h3>
          <p className="font-mono text-xs text-red-600 dark:text-red-400">{runState.mensaje}</p>
        </div>
      )}

      {/* ── Timeline + conclusion ──────────────────────────────────────────── */}
      {runState.status === "success" && (
        <div className="flex flex-col gap-6">
          <TimelineLab eventos={runState.resultado.eventos} />
          <ConclusionPanel resultado={runState.resultado} durationMs={durationMs} />
        </div>
      )}

      {/* ── Idle state ────────────────────────────────────────────────────── */}
      {runState.status === "idle" && (
        <div
          className="rounded-xl border border-border bg-card p-6 text-center"
          aria-label="Estado inicial — sin resultados"
        >
          <FlaskConicalIcon
            className="mx-auto mb-3 h-8 w-8 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            Seleccioná un escenario y presioná{" "}
            <span className="text-foreground">Ejecutar en DB real</span> para ver la
            timeline con los eventos reales de PostgreSQL.
          </p>
        </div>
      )}
    </div>
  )
}
