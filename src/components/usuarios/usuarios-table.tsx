"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OperadorFormDialog } from "@/components/usuarios/operador-form-dialog";
import { EliminarOperadorDialog } from "@/components/usuarios/eliminar-operador-dialog";
import type { Operador } from "@/lib/operadores";
import type { OperatorRole } from "@/lib/auth";

interface UsuariosTableProps {
  operadores: Operador[];
}

const ROLE_LABELS: Record<OperatorRole, string> = {
  admin: "Administrador",
  agente: "Agente",
  consulta: "Consulta",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const ROLE_BADGE_VARIANT: Record<OperatorRole, BadgeVariant> = {
  admin: "default",
  agente: "secondary",
  consulta: "outline",
};

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function UsuariosTable({ operadores }: UsuariosTableProps) {
  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Creado</TableHead>
            <TableHead className="text-right w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {operadores.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-10 text-center text-muted-foreground"
              >
                No hay operadores registrados
              </TableCell>
            </TableRow>
          ) : (
            operadores.map((op) => (
              <TableRow key={op.id}>
                <TableCell className="font-medium">{op.username}</TableCell>
                <TableCell>
                  <Badge variant={ROLE_BADGE_VARIANT[op.role]}>
                    {ROLE_LABELS[op.role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={op.activo ? "secondary" : "outline"}>
                    {op.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(op.creado_en)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <OperadorFormDialog operador={op} />
                    <EliminarOperadorDialog operador={op} />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
