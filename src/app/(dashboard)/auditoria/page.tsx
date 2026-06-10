import { ShieldCheckIcon } from "lucide-react"
import { AuditoriaTable } from "@/components/auditoria/auditoria-table"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Auditoría",
  description: "Registro automático de cada cambio en la base de datos.",
}

export default function AuditoriaPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* ── Encabezado ───────────────────────────────────────────── */}
      <header className="flex items-start gap-3">
        <ShieldCheckIcon
          className="mt-1 h-7 w-7 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Auditoría
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro automático de cada cambio en la base de datos.
          </p>
        </div>
      </header>

      {/* ── Bitácora ─────────────────────────────────────────────── */}
      <section aria-label="Bitácora de auditoría">
        <AuditoriaTable />
      </section>
    </div>
  )
}
