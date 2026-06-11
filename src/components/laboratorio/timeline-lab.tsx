"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { EventoLab } from "@/lib/laboratorio"

// ── Helpers ───────────────────────────────────────────────────────────────────

const NIVEL_DOT: Record<NonNullable<EventoLab["nivel"]>, string> = {
  info: "bg-slate-400 dark:bg-slate-400",
  lock: "bg-amber-600 dark:bg-amber-400",
  error: "bg-red-600 dark:bg-red-500",
  ok: "bg-emerald-600 dark:bg-emerald-400",
}

const NIVEL_TEXT: Record<NonNullable<EventoLab["nivel"]>, string> = {
  info: "text-foreground",
  lock: "text-amber-700 dark:text-amber-300",
  error: "text-red-600 dark:text-red-300",
  ok: "text-emerald-700 dark:text-emerald-300",
}

const NIVEL_BADGE_BG: Record<NonNullable<EventoLab["nivel"]>, string> = {
  info: "bg-muted text-muted-foreground",
  lock: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  error: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
}

const NIVEL_LABEL: Record<NonNullable<EventoLab["nivel"]>, string> = {
  info: "INFO",
  lock: "LOCK",
  error: "ERROR",
  ok: "OK",
}

const ACTOR_COL: Record<EventoLab["actor"], "left" | "center" | "right"> = {
  T1: "left",
  sistema: "center",
  T2: "right",
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface EventRowProps {
  evento: EventoLab
}

function EventRow({ evento }: EventRowProps) {
  const nivel = evento.nivel ?? "info"
  const col = ACTOR_COL[evento.actor]

  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] gap-2 items-start text-xs",
        "border-b border-border/50 py-2 last:border-0",
      )}
      aria-label={`${evento.actor} a t+${evento.t}ms: ${evento.mensaje}`}
    >
      {/* T1 column (left) */}
      <div
        className={cn(
          "flex flex-col gap-1",
          col !== "left" && "opacity-0 pointer-events-none",
        )}
        aria-hidden={col !== "left"}
      >
        {col === "left" && (
          <EventCard evento={evento} nivel={nivel} />
        )}
      </div>

      {/* Sistema / timestamp column (center) */}
      <div className="flex flex-col items-center gap-1 min-w-[4.5rem]">
        {col === "center" ? (
          <EventCard evento={evento} nivel={nivel} center />
        ) : (
          <>
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0 mt-0.5",
                NIVEL_DOT[nivel],
              )}
              aria-hidden="true"
            />
            <time
              dateTime={`PT${evento.t}MS`}
              className="text-[10px] text-muted-foreground tabular-nums"
            >
              +{evento.t}ms
            </time>
          </>
        )}
      </div>

      {/* T2 column (right) */}
      <div
        className={cn(
          "flex flex-col gap-1",
          col !== "right" && "opacity-0 pointer-events-none",
        )}
        aria-hidden={col !== "right"}
      >
        {col === "right" && (
          <EventCard evento={evento} nivel={nivel} />
        )}
      </div>
    </li>
  )
}

interface EventCardProps {
  evento: EventoLab
  nivel: NonNullable<EventoLab["nivel"]>
  center?: boolean
}

function EventCard({ evento, nivel, center = false }: EventCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-1.5",
        "border-border bg-muted/50",
        center && "text-center",
      )}
    >
      {/* Header row: nivel badge + timestamp */}
      <div className={cn("flex items-center gap-1.5 mb-1", center && "justify-center")}>
        <span
          className={cn(
            "rounded px-1 py-0.5 text-[10px] font-mono font-semibold leading-none",
            NIVEL_BADGE_BG[nivel],
          )}
          aria-label={`Nivel: ${NIVEL_LABEL[nivel]}`}
        >
          {NIVEL_LABEL[nivel]}
        </span>
        <time
          dateTime={`PT${evento.t}MS`}
          className="text-[10px] text-muted-foreground tabular-nums"
        >
          +{evento.t}ms
        </time>
      </div>

      {/* Message */}
      <p className={cn("leading-snug", NIVEL_TEXT[nivel])}>
        {evento.mensaje}
      </p>

      {/* SQL snippet */}
      {evento.sql && (
        <pre
          className="mt-1.5 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-[10px] leading-relaxed text-foreground whitespace-pre-wrap"
          aria-label="SQL ejecutado"
        >
          {evento.sql}
        </pre>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface TimelineLabProps {
  eventos: EventoLab[]
}

export function TimelineLab({ eventos }: TimelineLabProps) {
  const t1Events = eventos.filter((e) => e.actor === "T1")
  const t2Events = eventos.filter((e) => e.actor === "T2")

  return (
    <section
      aria-label="Timeline de transacciones concurrentes"
      className="flex flex-col gap-4"
    >
      {/* Column headers */}
      <div
        className="grid grid-cols-[1fr_auto_1fr] gap-2 text-center"
      >
        <div className="rounded-lg bg-primary/10 px-3 py-1.5">
          <span className="font-mono text-xs font-semibold text-primary">
            T1 ({t1Events.length} eventos)
          </span>
        </div>
        <div className="flex min-w-[4.5rem] items-center justify-center">
          <span className="font-mono text-[10px] text-muted-foreground">tiempo</span>
        </div>
        <div className="rounded-lg bg-primary/10 px-3 py-1.5">
          <span className="font-mono text-xs font-semibold text-primary">
            T2 ({t2Events.length} eventos)
          </span>
        </div>
      </div>

      {/* Timeline rows */}
      <ol
        className="rounded-xl border border-border bg-card px-3 py-2"
        aria-label="Secuencia de eventos de las transacciones"
      >
        {eventos.map((evento, i) => (
          <EventRow key={i} evento={evento} />
        ))}
      </ol>
    </section>
  )
}
