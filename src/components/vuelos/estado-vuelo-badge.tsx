import { cn } from "@/lib/utils"
import type { EstadoVuelo } from "@/lib/vuelos"

interface EstadoVueloBadgeProps {
  estado: EstadoVuelo
  retraso_min?: number
}

const ESTADO_CONFIG = {
  programado: {
    label: "Programado",
    containerClass: "bg-slate-100 text-slate-600",
    dotClass: "bg-slate-400",
  },
  abordando: {
    label: "Abordando",
    containerClass: "bg-blue-100 text-blue-700",
    dotClass: "bg-blue-500",
  },
  despegado: {
    label: "Despegado",
    containerClass: "bg-emerald-100 text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  aterrizado: {
    label: "Aterrizado",
    containerClass: "bg-gray-100 text-gray-600",
    dotClass: "bg-gray-400",
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

export function EstadoVueloBadge({ estado, retraso_min }: EstadoVueloBadgeProps) {
  const config = ESTADO_CONFIG[estado]
  const showRetraso = typeof retraso_min === "number" && retraso_min > 0

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-none",
          config.containerClass,
        )}
        aria-label={`Estado: ${config.label}${showRetraso ? `, retraso ${retraso_min} minutos` : ""}`}
      >
        <span
          className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)}
          aria-hidden="true"
        />
        {config.label}
      </span>
      {showRetraso && (
        <span
          className="pl-1 text-[10px] font-medium text-amber-600 tabular-nums"
          aria-hidden="true"
        >
          +{retraso_min} min
        </span>
      )}
    </span>
  )
}
