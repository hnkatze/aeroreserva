"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { KeyRound, Link2 } from "lucide-react";
import type { ColumnaInfo } from "@/lib/esquema";

// In React Flow v12, the custom node type must extend Node<DataShape>.
// We define the full node type here so NodeProps can be parameterised correctly.
export type TablaNode = Node<{
  nombre: string;
  columnas: ColumnaInfo[];
}>;

export function TablaNode({ data }: NodeProps<TablaNode>) {
  return (
    <div
      className="min-w-[200px] overflow-hidden rounded-lg border border-border bg-card shadow-md"
      aria-label={`Tabla ${data.nombre}`}
    >
      {/* Header */}
      <div className="bg-primary px-3 py-2">
        <p className="font-heading text-xs font-semibold uppercase tracking-wider text-primary-foreground">
          {data.nombre}
        </p>
      </div>

      {/* Columns */}
      <ul
        className="divide-y divide-border"
        role="list"
        aria-label={`Columnas de ${data.nombre}`}
      >
        {data.columnas.map((col: ColumnaInfo) => (
          <li key={col.nombre} className="flex items-center gap-2 px-3 py-1.5">
            {/* PK / FK indicator */}
            <span className="flex w-4 shrink-0 items-center justify-center">
              {col.esPK ? (
                <KeyRound
                  className="h-3 w-3 text-brand-accent"
                  aria-label="Primary key"
                />
              ) : col.esFK ? (
                <Link2
                  className="h-3 w-3 text-muted-foreground"
                  aria-label="Foreign key"
                />
              ) : null}
            </span>

            {/* Column name */}
            <span
              className={
                col.esPK
                  ? "text-xs font-semibold text-foreground"
                  : "text-xs text-foreground"
              }
            >
              {col.nombre}
            </span>

            {/* Data type */}
            <span className="ml-auto text-[10px] text-muted-foreground">
              {col.tipo}
            </span>

            {/* Nullable indicator */}
            {col.nullable && (
              <span
                className="text-[10px] text-muted-foreground/60"
                title="nullable"
              >
                ?
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* React Flow handles — one on each side */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-primary !bg-background"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-primary !bg-background"
      />
    </div>
  );
}
