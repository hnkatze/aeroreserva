import type { LucideIcon } from "lucide-react"
import { TrendingUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface KpiCardProps {
  label: string
  value: string
  icon: LucideIcon
  trend: string
  /** When true, renders with amber brand accent background. Text and icons use navy for contrast. */
  accent?: boolean
}

export function KpiCard({ label, value, icon: Icon, trend, accent = false }: KpiCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-5 shadow-sm",
        accent
          ? "border-amber-400 bg-amber-500"
          : "border-border bg-card",
      )}
      aria-label={label}
    >
      {/* Top row: label + icon square */}
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-sm font-medium leading-snug",
            accent ? "text-[#14275C]" : "text-muted-foreground",
          )}
        >
          {label}
        </p>

        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            accent ? "bg-[#14275C]/10" : "bg-primary/10",
          )}
          aria-hidden="true"
        >
          <Icon
            className={cn(
              "h-5 w-5",
              accent ? "text-[#14275C]" : "text-primary",
            )}
          />
        </div>
      </div>

      {/* Value */}
      <p
        className={cn(
          "font-heading text-3xl font-bold leading-none tracking-tight",
          accent ? "text-[#14275C]" : "text-foreground",
        )}
      >
        {value}
      </p>

      {/* Trend */}
      <div
        className={cn(
          "flex items-center gap-1",
          accent ? "text-[#14275C]" : "text-muted-foreground",
        )}
      >
        <TrendingUpIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="text-xs">{trend}</span>
      </div>
    </article>
  )
}
