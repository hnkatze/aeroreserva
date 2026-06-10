"use client"

import { InfoIcon } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { EntradaListaEspera } from "@/lib/lista-espera"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PosicionBadge({ posicion }: { posicion: number }) {
  const esPrimero = posicion === 1

  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold leading-none",
        esPrimero
          ? "bg-amber-400 text-[#14275C]"
          : "bg-muted text-muted-foreground",
      )}
      aria-label={`Posición ${posicion} en la lista`}
    >
      {posicion}
    </span>
  )
}

/** Inline badge explaining that promotion is automatic. */
function AutoPromocionNote() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      title="La promoción ocurre automáticamente vía trigger al cancelarse una reserva confirmada"
    >
      <InfoIcon className="h-3 w-3" aria-hidden="true" />
      Automática
    </span>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <TableRow>
      <TableCell
        colSpan={6}
        className="py-12 text-center text-sm text-muted-foreground"
      >
        No hay pasajeros en lista de espera.
      </TableCell>
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ListaEsperaTableProps {
  entradas: readonly EntradaListaEspera[]
}

export function ListaEsperaTable({ entradas }: ListaEsperaTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <Table aria-label="Lista de espera">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4 w-24">Posición</TableHead>
            <TableHead>Pasajero</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Vuelo</TableHead>
            <TableHead>Solicitado</TableHead>
            <TableHead className="pr-4 text-right">Promoción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entradas.length === 0 ? (
            <EmptyState />
          ) : (
            entradas.map((entrada) => (
              <TableRow
                key={entrada.id}
                className={cn(
                  entrada.posicion === 1 &&
                    "bg-amber-50/60 dark:bg-amber-950/20",
                )}
              >
                <TableCell className="pl-4">
                  <PosicionBadge posicion={entrada.posicion} />
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {entrada.pasajero_nombre}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">
                    {entrada.pasajero_documento}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{entrada.vuelo_codigo}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entrada.creado_en.toLocaleDateString("es-AR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {/*
                   * Promotion is fully automatic via the trg_promover_espera
                   * PL/pgSQL trigger that fires on reservas UPDATE.
                   * No manual action is required or exposed here.
                   */}
                  <AutoPromocionNote />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
