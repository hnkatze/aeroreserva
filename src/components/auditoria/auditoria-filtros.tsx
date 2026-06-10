"use client"

import { useState } from "react"
import { FilterIcon } from "lucide-react"
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

// MOCK — en producción estos valores vendrían de la DB
const TABLAS_MOCK = [
  "reservas",
  "vuelos",
  "pasajeros",
  "asientos",
  "operadores",
  "tarifas",
  "pagos",
] as const

type TablaDB = (typeof TABLAS_MOCK)[number]

export interface AuditoriaFiltros {
  operacion: OperacionSQL | ""
  tabla: TablaDB | ""
}

interface AuditoriaFiltrosProps {
  onFiltrar?: (filtros: AuditoriaFiltros) => void
}

export function AuditoriaFiltros({ onFiltrar }: AuditoriaFiltrosProps) {
  const [operacion, setOperacion] = useState<OperacionSQL | "">("")
  const [tabla, setTabla] = useState<TablaDB | "">("")

  function handleOperacionChange(value: string | null) {
    const next = (value ?? "") as OperacionSQL | ""
    setOperacion(next)
    onFiltrar?.({ operacion: next, tabla })
  }

  function handleTablaChange(value: string | null) {
    const next = (value ?? "") as TablaDB | ""
    setTabla(next)
    onFiltrar?.({ operacion, tabla: next })
  }

  return (
    <Card>
      <CardContent className="px-5 py-4">
        <fieldset>
          <legend className="sr-only">Filtros de auditoría</legend>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            {/* Ícono decorativo */}
            <div className="hidden items-center self-end pb-2 text-muted-foreground sm:flex">
              <FilterIcon className="h-4 w-4" aria-hidden="true" />
            </div>

            {/* Operación */}
            <div className="flex flex-col gap-1.5 sm:w-48">
              <Label
                htmlFor="filtro-operacion"
                className="text-xs font-medium text-muted-foreground"
              >
                Operación
              </Label>
              <Select
                value={operacion || undefined}
                onValueChange={handleOperacionChange}
              >
                <SelectTrigger id="filtro-operacion" className="h-9 font-mono text-sm">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSERT">
                    <span className="font-mono">INSERT</span>
                  </SelectItem>
                  <SelectItem value="UPDATE">
                    <span className="font-mono">UPDATE</span>
                  </SelectItem>
                  <SelectItem value="DELETE">
                    <span className="font-mono">DELETE</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabla */}
            <div className="flex flex-col gap-1.5 sm:w-48">
              <Label
                htmlFor="filtro-tabla"
                className="text-xs font-medium text-muted-foreground"
              >
                Tabla
              </Label>
              <Select
                value={tabla || undefined}
                onValueChange={handleTablaChange}
              >
                <SelectTrigger id="filtro-tabla" className="h-9 font-mono text-sm">
                  <SelectValue placeholder="Todas las tablas" />
                </SelectTrigger>
                <SelectContent>
                  {TABLAS_MOCK.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="font-mono">{t}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Indicador de filtros activos */}
            <p
              aria-live="polite"
              aria-atomic="true"
              className="self-end pb-2 font-mono text-xs text-muted-foreground"
            >
              {(operacion || tabla)
                ? `Filtrando por${operacion ? ` ${operacion}` : ""}${tabla ? ` · ${tabla}` : ""}`
                : ""}
            </p>
          </div>
        </fieldset>
      </CardContent>
    </Card>
  )
}
