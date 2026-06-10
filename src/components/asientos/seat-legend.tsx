import { cn } from "@/lib/utils"

interface LegendItemProps {
  className: string
  label: string
}

function LegendItem({ className, label }: LegendItemProps) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cn(
          "inline-block h-6 w-6 shrink-0 rounded-md border",
          className
        )}
        aria-hidden="true"
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </li>
  )
}

export function SeatLegend() {
  return (
    <nav aria-label="Leyenda de asientos">
      <ul className="flex flex-wrap gap-x-6 gap-y-2" role="list">
        <LegendItem className="border-border bg-background" label="Libre" />
        <LegendItem className="border-primary/30 bg-primary" label="Ocupado" />
        <LegendItem
          className="border-amber-400 bg-amber-500"
          label="Seleccionado"
        />
        <LegendItem
          className="border-indigo-300 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-950/40"
          label="Ejecutiva (libre)"
        />
      </ul>
    </nav>
  )
}
