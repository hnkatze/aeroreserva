import { cn } from "@/lib/utils"

export type EstadoReserva = "confirmada" | "en_espera" | "cancelada"

interface EstadoReservaBadgeProps {
  estado: EstadoReserva
}

const ESTADO_CONFIG = {
  confirmada: {
    label: "Confirmada",
    containerClass: "bg-emerald-100 text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  en_espera: {
    label: "En espera",
    containerClass: "bg-amber-100 text-amber-800",
    dotClass: "bg-amber-500",
  },
  cancelada: {
    label: "Cancelada",
    containerClass: "bg-red-100 text-red-700",
    dotClass: "bg-red-500",
  },
} as const satisfies Record<
  EstadoReserva,
  { label: string; containerClass: string; dotClass: string }
>

export function EstadoReservaBadge({ estado }: EstadoReservaBadgeProps) {
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
