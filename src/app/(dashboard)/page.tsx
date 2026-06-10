import { getCurrentOperator } from "@/lib/auth"
import { PlaneIcon, UsersIcon, CalendarIcon } from "lucide-react"

export default async function DashboardHomePage() {
  const operator = await getCurrentOperator()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Bienvenido, {operator?.username}
        </h1>
        <p className="text-sm text-muted-foreground">
          Panel de control de AeroReserva
        </p>
      </div>

      <section aria-label="Resumen del sistema">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          <li className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <UsersIcon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Usuarios</p>
                <p className="text-xs text-muted-foreground">Gestión de operadores</p>
              </div>
            </div>
          </li>

          <li className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <PlaneIcon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Vuelos</p>
                <p className="text-xs text-muted-foreground">Próximamente disponible</p>
              </div>
            </div>
          </li>

          <li className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <CalendarIcon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Reservas</p>
                <p className="text-xs text-muted-foreground">Próximamente disponible</p>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  )
}
