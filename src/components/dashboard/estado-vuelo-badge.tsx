import { cn } from "@/lib/utils"

export type EstadoVuelo =
  | "programado"
  | "abordando"
  | "despegado"
  | "aterrizado"
  | "retrasado"
  | "cancelado"

interface EstadoVueloBadgeProps {
  estado: EstadoVuelo
}

const ESTADO_CONFIG = {
  programado: {
    label: "Programado",
    containerClass: "bg-sky-100 text-sky-700",
    dotClass: "bg-sky-500",
  },
  abordando: {
    label: "Abordando",
    containerClass: "bg-blue-100 text-blue-700",
    dotClass: "bg-blue-500",
  },
  despegado: {
    label: "Despegado",
    containerClass: "bg-indigo-100 text-indigo-700",
    dotClass: "bg-indigo-500",
  },
  aterrizado: {
    label: "Aterrizado",
    containerClass: "bg-green-100 text-green-700",
    dotClass: "bg-green-500",
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
  const config = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG.programado

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
