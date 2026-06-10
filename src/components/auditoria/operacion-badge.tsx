import { cn } from "@/lib/utils"

export type OperacionSQL = "INSERT" | "UPDATE" | "DELETE"

interface OperacionBadgeProps {
  operacion: OperacionSQL
}

const OPERACION_CONFIG = {
  INSERT: {
    containerClass: "bg-emerald-100 text-emerald-800",
  },
  UPDATE: {
    containerClass: "bg-amber-100 text-[#14275C]",
  },
  DELETE: {
    containerClass: "bg-red-100 text-red-800",
  },
} as const satisfies Record<OperacionSQL, { containerClass: string }>

export function OperacionBadge({ operacion }: OperacionBadgeProps) {
  const config = OPERACION_CONFIG[operacion]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold leading-none tracking-wide",
        config.containerClass,
      )}
      aria-label={`Operación: ${operacion}`}
    >
      {operacion}
    </span>
  )
}
