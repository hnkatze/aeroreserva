"use client"

import { useRouter, usePathname } from "next/navigation"
import { FilterIcon, XIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import type { OperacionSQL } from "@/components/auditoria/operacion-badge"

const OPERACIONES: readonly OperacionSQL[] = ["INSERT", "UPDATE", "DELETE"]

// Radix Select cannot use an empty-string value, so a sentinel represents the
// "no filter" option; it is mapped back to "" before navigating.
const ALL = "__all"

export interface AuditoriaFiltrosValores {
  operacion: OperacionSQL | ""
  tabla: string
  usuario: string
  desde: string
  hasta: string
}

interface AuditoriaFiltrosProps {
  /** Distinct table names actually present in the audit log. */
  tablas: readonly string[]
  /** Distinct DB roles actually present in the audit log. */
  usuarios: readonly string[]
  /** Currently active filter values (from the URL). */
  valores: AuditoriaFiltrosValores
}

export function AuditoriaFiltros({
  tablas,
  usuarios,
  valores,
}: AuditoriaFiltrosProps) {
  const router = useRouter()
  const pathname = usePathname()

  const hayFiltros = Boolean(
    valores.operacion ||
      valores.tabla ||
      valores.usuario ||
      valores.desde ||
      valores.hasta,
  )

  // Merge a change into the active filters and navigate. Paging resets because
  // we don't carry `page` over — a new filter starts at page 1.
  function aplicar(cambios: Partial<AuditoriaFiltrosValores>): void {
    const merged: AuditoriaFiltrosValores = { ...valores, ...cambios }
    const params = new URLSearchParams()
    if (merged.operacion) params.set("operacion", merged.operacion)
    if (merged.tabla) params.set("tabla", merged.tabla)
    if (merged.usuario) params.set("usuario", merged.usuario)
    if (merged.desde) params.set("desde", merged.desde)
    if (merged.hasta) params.set("hasta", merged.hasta)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function limpiar(): void {
    router.push(pathname)
  }

  return (
    <Card>
      <CardContent className="px-5 py-4">
        <fieldset>
          <legend className="sr-only">Filtros de auditoría</legend>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
            {/* Ícono decorativo */}
            <div className="hidden items-center self-end pb-2 text-muted-foreground sm:flex">
              <FilterIcon className="h-4 w-4" aria-hidden="true" />
            </div>

            {/* Operación */}
            <div className="flex flex-col gap-1.5 sm:w-40">
              <Label
                htmlFor="filtro-operacion"
                className="text-xs font-medium text-muted-foreground"
              >
                Operación
              </Label>
              <Select
                value={valores.operacion || ALL}
                onValueChange={(v) =>
                  aplicar({
                    operacion: v && v !== ALL ? (v as OperacionSQL) : "",
                  })
                }
              >
                <SelectTrigger id="filtro-operacion" className="h-9 font-mono text-sm">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {OPERACIONES.map((op) => (
                    <SelectItem key={op} value={op}>
                      <span className="font-mono">{op}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tabla */}
            <div className="flex flex-col gap-1.5 sm:w-40">
              <Label
                htmlFor="filtro-tabla"
                className="text-xs font-medium text-muted-foreground"
              >
                Tabla
              </Label>
              <Select
                value={valores.tabla || ALL}
                onValueChange={(v) => aplicar({ tabla: v && v !== ALL ? v : "" })}
              >
                <SelectTrigger id="filtro-tabla" className="h-9 font-mono text-sm">
                  <SelectValue placeholder="Todas las tablas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas las tablas</SelectItem>
                  {tablas.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="font-mono">{t}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Usuario BD */}
            <div className="flex flex-col gap-1.5 sm:w-40">
              <Label
                htmlFor="filtro-usuario"
                className="text-xs font-medium text-muted-foreground"
              >
                Usuario BD
              </Label>
              <Select
                value={valores.usuario || ALL}
                onValueChange={(v) => aplicar({ usuario: v && v !== ALL ? v : "" })}
              >
                <SelectTrigger id="filtro-usuario" className="h-9 font-mono text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u} value={u}>
                      <span className="font-mono">{u}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Desde */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="filtro-desde"
                className="text-xs font-medium text-muted-foreground"
              >
                Desde
              </Label>
              <input
                id="filtro-desde"
                type="date"
                value={valores.desde}
                max={valores.hasta || undefined}
                onChange={(e) => aplicar({ desde: e.target.value })}
                className="h-9 rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Hasta */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="filtro-hasta"
                className="text-xs font-medium text-muted-foreground"
              >
                Hasta
              </Label>
              <input
                id="filtro-hasta"
                type="date"
                value={valores.hasta}
                min={valores.desde || undefined}
                onChange={(e) => aplicar({ hasta: e.target.value })}
                className="h-9 rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Limpiar */}
            {hayFiltros && (
              <button
                type="button"
                onClick={limpiar}
                className="flex h-9 items-center gap-1.5 self-end rounded-md border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Limpiar
              </button>
            )}
          </div>
        </fieldset>
      </CardContent>
    </Card>
  )
}
