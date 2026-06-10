"use client";

import { cn } from "@/lib/utils";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OperadorFormDialog } from "@/components/usuarios/operador-form-dialog";
import { EliminarOperadorDialog } from "@/components/usuarios/eliminar-operador-dialog";
import type { Operador } from "@/lib/operadores";
import type { OperatorRole } from "@/lib/auth";

interface UsuariosTableProps {
  operadores: Operador[];
}

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  admin: {
    label: "Administrador",
    containerClass: "bg-primary text-primary-foreground",
    dotClass: "bg-primary-foreground/70",
  },
  agente: {
    label: "Agente",
    containerClass: "bg-amber-100 text-amber-800",
    dotClass: "bg-amber-500",
  },
  consulta: {
    label: "Consulta",
    containerClass:
      "border border-border bg-background text-muted-foreground",
    dotClass: "bg-muted-foreground/50",
  },
} as const satisfies Record<
  OperatorRole,
  { label: string; containerClass: string; dotClass: string }
>;

function RoleBadge({ role }: { role: OperatorRole }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-none",
        cfg.containerClass,
      )}
      aria-label={`Rol: ${cfg.label}`}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", cfg.dotClass)}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  );
}

// ── Estado badge ──────────────────────────────────────────────────────────────

function EstadoBadge({ activo }: { activo: boolean }) {
  if (activo) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold leading-none text-emerald-700"
        aria-label="Estado: Activo"
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-500"
          aria-hidden="true"
        />
        Activo
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold leading-none text-slate-500"
      aria-label="Estado: Inactivo"
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-slate-400"
        aria-hidden="true"
      />
      Inactivo
    </span>
  );
}

// ── Avatar con iniciales ──────────────────────────────────────────────────────

function UserAvatar({ username }: { username: string }) {
  const initials = username.slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

// ── Fecha ─────────────────────────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

// ── Tabla principal ───────────────────────────────────────────────────────────

export function UsuariosTable({ operadores }: UsuariosTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Creado</TableHead>
            <TableHead className="pr-4 text-right">Acciones</TableHead>
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
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar username={op.username} />
                    <span className="font-medium">{op.username}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <RoleBadge role={op.role} />
                </TableCell>
                <TableCell>
                  <EstadoBadge activo={op.activo} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(op.creado_en)}
                </TableCell>
                <TableCell className="pr-4 text-right">
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
