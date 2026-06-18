"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  InfoIcon,
  PlaneIcon,
  MoreHorizontalIcon,
  ArrowUpCircleIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
// Row actions menu — manual promote / cancel (migration 013)
// ---------------------------------------------------------------------------

function EsperaActionsMenu({ entrada }: { entrada: EntradaListaEspera }) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)

  async function ejecutar(accion: "promover" | "cancelar"): Promise<void> {
    if (enviando) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/lista-espera/${entrada.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      })

      if (res.ok) {
        toast.success(
          accion === "promover"
            ? `${entrada.pasajero_nombre} fue promovido a un asiento`
            : `${entrada.pasajero_nombre} salió de la lista de espera`,
        )
        router.refresh()
        return
      }

      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null
      toast.error(data?.error ?? "No se pudo completar la acción")
    } catch {
      toast.error("No se pudo completar la acción")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Acciones para ${entrada.pasajero_nombre} en lista de espera`}
          />
        }
      >
        <MoreHorizontalIcon className="h-4 w-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem
          onClick={() => { void ejecutar("promover") }}
          disabled={enviando}
        >
          <ArrowUpCircleIcon className="h-4 w-4" aria-hidden="true" />
          Promover ahora
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => { void ejecutar("cancelar") }}
          disabled={enviando}
        >
          <XCircleIcon className="h-4 w-4" aria-hidden="true" />
          Cancelar espera
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// Grouping — each flight is an independent queue, so the position numbering
// (1, 2, 3…) is PER FLIGHT. We group consecutive entries by flight code so the
// repeated "1"s read as "first in line for THIS flight", not a bug.
// ---------------------------------------------------------------------------

interface GrupoVuelo {
  vuelo_codigo: string
  entradas: EntradaListaEspera[]
}

function agruparPorVuelo(
  entradas: readonly EntradaListaEspera[],
): GrupoVuelo[] {
  const grupos: GrupoVuelo[] = []
  const indice = new Map<string, GrupoVuelo>()

  for (const entrada of entradas) {
    let grupo = indice.get(entrada.vuelo_codigo)
    if (!grupo) {
      grupo = { vuelo_codigo: entrada.vuelo_codigo, entradas: [] }
      indice.set(entrada.vuelo_codigo, grupo)
      grupos.push(grupo)
    }
    grupo.entradas.push(entrada)
  }

  return grupos
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const COL_COUNT = 6

interface ListaEsperaTableProps {
  entradas: readonly EntradaListaEspera[]
}

export function ListaEsperaTable({ entradas }: ListaEsperaTableProps) {
  const grupos = agruparPorVuelo(entradas)

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table aria-label="Lista de espera agrupada por vuelo">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4 w-24">Posición</TableHead>
            <TableHead>Pasajero</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Solicitado</TableHead>
            <TableHead>Promoción</TableHead>
            <TableHead className="pr-4 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>

        {entradas.length === 0 ? (
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={COL_COUNT}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                No hay pasajeros en lista de espera.
              </TableCell>
            </TableRow>
          </TableBody>
        ) : (
          grupos.map((grupo) => (
            <TableBody key={grupo.vuelo_codigo}>
              {/* Flight group header — clarifies that the queue is per flight */}
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={COL_COUNT} className="py-2 pl-4">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    <PlaneIcon
                      className="h-3.5 w-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="font-mono">{grupo.vuelo_codigo}</span>
                    <span className="font-normal text-muted-foreground">
                      · {grupo.entradas.length} en espera
                    </span>
                  </span>
                </TableCell>
              </TableRow>

              {grupo.entradas.map((entrada) => (
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
                  <TableCell className="text-muted-foreground">
                    {entrada.creado_en.toLocaleDateString("es-HN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    {/*
                     * Promotion is automatic via the trg_promover_espera
                     * PL/pgSQL trigger when a seat is freed — but an operator
                     * can also act manually with the actions menu.
                     */}
                    <AutoPromocionNote />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <EsperaActionsMenu entrada={entrada} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          ))
        )}
      </Table>
    </div>
  )
}
