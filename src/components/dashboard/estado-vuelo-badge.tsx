import { cn } from "@/lib/utils"

export type EstadoVuelo = "programado" | "retrasado" | "cancelado"

interface EstadoVueloBadgeProps {
  estado: EstadoVuelo
}

const ESTADO_CONFIG = {
  programado: {
    label: "Programado",
    containerClass: "bg-sky-100 text-sky-700",
    dotClass: "bg-sky-500",
  },
  retrasado: {
    label: "Retrasado",
    containerClass: "bg-amber-100 text-amber-700",
    dotClass: "bg-amber-500",
  },
  cancelado: {
    label: "Cancelado",
    containerClass: "bg-red-100 text-red-700",
    dotClass: "bg-red-500",
  },
} as const satisfies Record<
  EstadoVuelo,
  { label: string; containerClass: string; dotClass: string }
>

export function EstadoVueloBadge({ estado }: EstadoVueloBadgeProps) {
  const config = ESTADO_CONFIG[estado]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-none",
        config.containerClass,
      )}
      aria-label={`Estado: ${config.label}`}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)}
        aria-hidden="true"
      />
      {config.label}
    </span>
  )
}
