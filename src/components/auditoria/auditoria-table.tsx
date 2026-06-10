"use client"

import { useState } from "react"
import { DatabaseIcon } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  OperacionBadge,
  type OperacionSQL,
} from "@/components/auditoria/operacion-badge"
import { AuditoriaFiltros, type AuditoriaFiltros as Filtros } from "@/components/auditoria/auditoria-filtros"

// MOCK — registros de auditoría generados por triggers de PostgreSQL
interface RegistroAuditoria {
  id: number
  operacion: OperacionSQL
  tabla: string
  registro: string
  usuarioBD: string
  fechaHora: string
}

const AUDITORIA_MOCK: readonly RegistroAuditoria[] = [
  {
    id: 1,
    operacion: "INSERT",
    tabla: "reservas",
    registro: "#1287",
    usuarioBD: "agente_caja",
    fechaHora: "2026-06-09 14:32:08",
  },
  {
    id: 2,
    operacion: "UPDATE",
    tabla: "reservas",
    registro: "#1201",
    usuarioBD: "agente_caja",
    fechaHora: "2026-06-09 14:28:44",
  },
  {
    id: 3,
    operacion: "DELETE",
    tabla: "pasajeros",
    registro: "#0392",
    usuarioBD: "admin_db",
    fechaHora: "2026-06-09 13:55:17",
  },
  {
    id: 4,
    operacion: "INSERT",
    tabla: "vuelos",
    registro: "#0088",
    usuarioBD: "operaciones",
    fechaHora: "2026-06-09 12:10:03",
  },
  {
    id: 5,
    operacion: "UPDATE",
    tabla: "vuelos",
    registro: "#0081",
    usuarioBD: "operaciones",
    fechaHora: "2026-06-09 11:47:30",
  },
  {
    id: 6,
    operacion: "DELETE",
    tabla: "reservas",
    registro: "#1180",
    usuarioBD: "agente_caja",
    fechaHora: "2026-06-09 11:22:55",
  },
  {
    id: 7,
    operacion: "INSERT",
    tabla: "asientos",
    registro: "#4420",
    usuarioBD: "operaciones",
    fechaHora: "2026-06-09 10:58:12",
  },
  {
    id: 8,
    operacion: "UPDATE",
    tabla: "tarifas",
    registro: "#0019",
    usuarioBD: "admin_db",
    fechaHora: "2026-06-09 10:33:41",
  },
  {
    id: 9,
    operacion: "INSERT",
    tabla: "pagos",
    registro: "#2091",
    usuarioBD: "agente_caja",
    fechaHora: "2026-06-09 09:44:29",
  },
  {
    id: 10,
    operacion: "DELETE",
    tabla: "vuelos",
    registro: "#0074",
    usuarioBD: "admin_db",
    fechaHora: "2026-06-08 23:18:05",
  },
  {
    id: 11,
    operacion: "UPDATE",
    tabla: "pasajeros",
    registro: "#0511",
    usuarioBD: "agente_caja",
    fechaHora: "2026-06-08 22:07:38",
  },
  {
    id: 12,
    operacion: "INSERT",
    tabla: "operadores",
    registro: "#0024",
    usuarioBD: "admin_db",
    fechaHora: "2026-06-08 18:00:01",
  },
] as const

export function AuditoriaTable() {
  const [filtros, setFiltros] = useState<Filtros>({ operacion: "", tabla: "" })

  const registrosFiltrados = AUDITORIA_MOCK.filter((r) => {
    if (filtros.operacion && r.operacion !== filtros.operacion) return false
    if (filtros.tabla && r.tabla !== filtros.tabla) return false
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <AuditoriaFiltros onFiltrar={setFiltros} />

      {/* Tabla */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Operación</TableHead>
              <TableHead>Tabla</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Usuario BD</TableHead>
              <TableHead className="pr-4">Fecha / hora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <DatabaseIcon className="h-8 w-8 opacity-30" aria-hidden="true" />
                    <p className="font-mono text-sm">
                      Sin registros para los filtros seleccionados
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              registrosFiltrados.map((registro) => (
                <TableRow key={registro.id}>
                  {/* Operación */}
                  <TableCell className="pl-4">
                    <OperacionBadge operacion={registro.operacion} />
                  </TableCell>

                  {/* Tabla */}
                  <TableCell>
                    <span className="font-mono text-xs text-foreground">
                      {registro.tabla}
                    </span>
                  </TableCell>

                  {/* Registro */}
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {registro.registro}
                    </span>
                  </TableCell>

                  {/* Usuario BD */}
                  <TableCell>
                    <span className="font-mono text-xs text-foreground">
                      {registro.usuarioBD}
                    </span>
                  </TableCell>

                  {/* Fecha / hora */}
                  <TableCell className="pr-4">
                    <time
                      dateTime={registro.fechaHora.replace(" ", "T")}
                      className="font-mono text-xs tabular-nums text-muted-foreground"
                    >
                      {registro.fechaHora}
                    </time>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Footer con conteo */}
        <div
          className="border-t px-4 py-2"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="font-mono text-xs text-muted-foreground">
            {registrosFiltrados.length} de {AUDITORIA_MOCK.length} registros
          </p>
        </div>
      </div>
    </div>
  )
}
