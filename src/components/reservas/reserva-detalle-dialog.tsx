"use client"

import { useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  EstadoReservaBadge,
  type EstadoReserva,
} from "@/components/reservas/estado-reserva-badge"
import { OperacionBadge } from "@/components/auditoria/operacion-badge"
import type { RegistroBitacora } from "@/lib/bitacora"

// ---------------------------------------------------------------------------
// Client-side DTO (Date fields serialised to string by JSON)
// ---------------------------------------------------------------------------

interface ReservaDetalleDTO {
  id: number
  estado: string
  fecha: string
  pasajero_nombre: string
  pasajero_documento: string
  vuelo_codigo: string
  vuelo_origen: string
  vuelo_destino: string
  vuelo_salida: string
  vuelo_llegada: string
  vuelo_estado: string
  asiento_numero: string
  asiento_clase: string
  operador_username: string | null
}

interface AuditoriaEntryDTO extends Omit<RegistroBitacora, "creado_en"> {
  creado_en: string
}

// ---------------------------------------------------------------------------
// Discriminated-union state
// ---------------------------------------------------------------------------

type DetalleState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; reserva: ReservaDetalleDTO; auditoria: AuditoriaEntryDTO[] }
  | { status: "error"; message: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KNOWN_ESTADOS: readonly EstadoReserva[] = [
  "confirmada",
  "en_espera",
  "cancelada",
]

function toEstadoBadge(estado: string): EstadoReserva {
  return (KNOWN_ESTADOS as readonly string[]).includes(estado)
    ? (estado as EstadoReserva)
    : "confirmada"
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface CambioDiff {
  campo: string
  antes: unknown
  despues: unknown
}

function diffCambios(
  antes: Record<string, unknown> | null,
  despues: Record<string, unknown> | null,
): CambioDiff[] {
  if (!antes || !despues) return []
  const campos = new Set([...Object.keys(antes), ...Object.keys(despues)])
  const cambios: CambioDiff[] = []
  for (const campo of campos) {
    const valorAntes = antes[campo]
    const valorDespues = despues[campo]
    // Use JSON stringification to compare objects / arrays / primitives uniformly
    if (JSON.stringify(valorAntes) !== JSON.stringify(valorDespues)) {
      cambios.push({ campo, antes: valorAntes, despues: valorDespues })
    }
  }
  return cambios
}

function renderValor(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

// ---------------------------------------------------------------------------
// Audit trail entry
// ---------------------------------------------------------------------------

interface AuditoriaEntryProps {
  entry: AuditoriaEntryDTO
  index: number
}

function AuditoriaEntry({ entry, index }: AuditoriaEntryProps) {
  const actorParts: string[] = [entry.usuario_bd]
  if (entry.operador_id !== null) {
    actorParts.push(`operador #${entry.operador_id}`)
  }
  const actor = actorParts.join(" / ")

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{index + 1}.</span>
        <OperacionBadge operacion={entry.operacion} />
        <time
          dateTime={entry.creado_en}
          className="text-xs text-muted-foreground"
        >
          {formatDateTime(entry.creado_en)}
        </time>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {actor}
        </span>
      </div>

      {entry.operacion === "INSERT" && (
        <p className="text-xs text-foreground/80">
          Reserva creada
          {entry.datos_nuevos?.estado
            ? ` — estado inicial: ${String(entry.datos_nuevos.estado)}`
            : ""}
        </p>
      )}

      {entry.operacion === "UPDATE" && (() => {
        const cambios = diffCambios(entry.datos_anteriores, entry.datos_nuevos)
        if (cambios.length === 0) {
          return (
            <p className="text-xs text-muted-foreground">Sin cambios detectados.</p>
          )
        }
        return (
          <ul className="flex flex-col gap-0.5">
            {cambios.map((c) => (
              <li key={c.campo} className="flex gap-1 text-xs">
                <span className="font-mono text-muted-foreground">{c.campo}:</span>
                <span className="text-red-600 line-through">{renderValor(c.antes)}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-emerald-700">{renderValor(c.despues)}</span>
              </li>
            ))}
          </ul>
        )
      })()}

      {entry.operacion === "DELETE" && (
        <p className="text-xs text-red-700">Reserva eliminada.</p>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// ReservaDetalleDialog
// ---------------------------------------------------------------------------

interface ReservaDetalleDialogProps {
  reservaId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReservaDetalleDialog({
  reservaId,
  open,
  onOpenChange,
}: ReservaDetalleDialogProps) {
  const [state, setState] = useState<DetalleState>({ status: "idle" })

  useEffect(() => {
    if (!open || reservaId === null) {
      setState({ status: "idle" })
      return
    }

    let cancelled = false
    setState({ status: "loading" })

    void (async () => {
      try {
        const res = await fetch(`/api/reservas/${reservaId}`)
        if (cancelled) return

        if (!res.ok) {
          const body: unknown = await res.json().catch(() => ({}))
          const message =
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof (body as { error: unknown }).error === "string"
              ? (body as { error: string }).error
              : "No se pudo cargar el detalle."
          setState({ status: "error", message })
          return
        }

        const json: unknown = await res.json()
        if (
          typeof json !== "object" ||
          json === null ||
          !("reserva" in json) ||
          !("auditoria" in json)
        ) {
          setState({ status: "error", message: "Respuesta inesperada del servidor." })
          return
        }

        const { reserva, auditoria } = json as {
          reserva: ReservaDetalleDTO
          auditoria: AuditoriaEntryDTO[]
        }
        setState({ status: "success", reserva, auditoria })
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Error de red al cargar el detalle." })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, reservaId])

  const title =
    reservaId !== null
      ? `Reserva RSV-${String(reservaId).padStart(5, "0")}`
      : "Detalle de reserva"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle>{title}</DialogTitle>
            {state.status === "success" && (
              <EstadoReservaBadge estado={toEstadoBadge(state.reserva.estado)} />
            )}
          </div>
        </DialogHeader>

        {/* ---- Loading ---- */}
        {state.status === "loading" && (
          <div
            className="flex flex-col gap-2 py-6"
            aria-live="polite"
            aria-busy="true"
          >
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-4 animate-pulse rounded bg-muted"
                aria-hidden="true"
              />
            ))}
            <span className="sr-only">Cargando…</span>
          </div>
        )}

        {/* ---- Error ---- */}
        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {state.message}
          </p>
        )}

        {/* ---- Success ---- */}
        {state.status === "success" && (
          <div className="flex flex-col gap-5">
            {/* Reservation data */}
            <section aria-labelledby="seccion-datos">
              <h3
                id="seccion-datos"
                className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Datos de la reserva
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="font-medium text-muted-foreground">Pasajero</dt>
                <dd>
                  {state.reserva.pasajero_nombre}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({state.reserva.pasajero_documento})
                  </span>
                </dd>

                <dt className="font-medium text-muted-foreground">Vuelo</dt>
                <dd>
                  <span className="font-mono text-xs">{state.reserva.vuelo_codigo}</span>
                </dd>

                <dt className="font-medium text-muted-foreground">Ruta</dt>
                <dd>
                  {state.reserva.vuelo_origen}
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  {state.reserva.vuelo_destino}
                </dd>

                <dt className="font-medium text-muted-foreground">Salida</dt>
                <dd>{formatDateTime(state.reserva.vuelo_salida)}</dd>

                <dt className="font-medium text-muted-foreground">Llegada</dt>
                <dd>{formatDateTime(state.reserva.vuelo_llegada)}</dd>

                <dt className="font-medium text-muted-foreground">Asiento</dt>
                <dd>
                  <span className="font-mono text-xs">{state.reserva.asiento_numero}</span>
                  {" — "}
                  {capitalize(state.reserva.asiento_clase)}
                </dd>

                <dt className="font-medium text-muted-foreground">Operador</dt>
                <dd>{state.reserva.operador_username ?? "—"}</dd>

                <dt className="font-medium text-muted-foreground">Creada</dt>
                <dd>{formatDateTime(state.reserva.fecha)}</dd>
              </dl>
            </section>

            {/* Audit trail */}
            <section aria-labelledby="seccion-auditoria">
              <h3
                id="seccion-auditoria"
                className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Traza de auditoría
              </h3>
              {state.auditoria.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin registros de auditoría.
                </p>
              ) : (
                <ol className="flex flex-col gap-2" aria-label="Historial de cambios">
                  {state.auditoria.map((entry, i) => (
                    <AuditoriaEntry key={entry.id} entry={entry} index={i} />
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
