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
import type { RegistroBitacora } from "@/lib/bitacora"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date (or ISO string from JSON serialisation) for display. */
function formatFecha(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value)
  // "YYYY-MM-DD HH:mm:ss" — same style as the original mock data
  return d.toISOString().replace("T", " ").slice(0, 19)
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AuditoriaTableProps {
  /** Records for the current page — already filtered server-side. */
  registros: readonly RegistroBitacora[]
  /** Total matching records across all pages (for the footer count). */
  total: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditoriaTable({ registros, total }: AuditoriaTableProps) {
  return (
    <div className="rounded-xl border bg-card">
      <Table aria-label="Registros de auditoría">
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
          {registros.length === 0 ? (
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
            registros.map((registro) => (
              <TableRow key={registro.id}>
                {/* Operación */}
                <TableCell className="pl-4">
                  <OperacionBadge operacion={registro.operacion as OperacionSQL} />
                </TableCell>

                {/* Tabla */}
                <TableCell>
                  <span className="font-mono text-xs text-foreground">
                    {registro.tabla}
                  </span>
                </TableCell>

                {/* Registro — format as #NNNN to match original style */}
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">
                    {registro.registro_id != null
                      ? `#${registro.registro_id.padStart(4, "0")}`
                      : "—"}
                  </span>
                </TableCell>

                {/* Usuario BD + operador_id when available */}
                <TableCell>
                  <span className="font-mono text-xs text-foreground">
                    {registro.usuario_bd}
                    {registro.operador_id != null && (
                      <span className="ml-1 text-muted-foreground">
                        (op:{registro.operador_id})
                      </span>
                    )}
                  </span>
                </TableCell>

                {/* Fecha / hora */}
                <TableCell className="pr-4">
                  <time
                    dateTime={
                      registro.creado_en instanceof Date
                        ? registro.creado_en.toISOString()
                        : String(registro.creado_en)
                    }
                    className="font-mono text-xs tabular-nums text-muted-foreground"
                  >
                    {formatFecha(registro.creado_en)}
                  </time>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Footer con conteo */}
      <div className="border-t px-4 py-2">
        <p
          aria-live="polite"
          aria-atomic="true"
          className="font-mono text-xs text-muted-foreground"
        >
          Mostrando {registros.length} de {total} registros
        </p>
      </div>
    </div>
  )
}
