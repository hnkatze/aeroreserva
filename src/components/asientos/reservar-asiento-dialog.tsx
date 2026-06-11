"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  PasajeroCombobox,
  type PasajeroSeleccion,
} from "@/components/pasajeros/pasajero-combobox"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AsientoInfo {
  dbId: number
  numero: string
  clase: string
}

interface ReservarAsientoDialogProps {
  vueloId: number
  asiento: AsientoInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormFields {
  pasajero: PasajeroSeleccion | null
}

const EMPTY_FIELDS: FormFields = { pasajero: null }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReservarAsientoDialog({
  vueloId,
  asiento,
  open,
  onOpenChange,
}: ReservarAsientoDialogProps) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [fields, setFields] = React.useState<FormFields>(EMPTY_FIELDS)
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<keyof FormFields, string>>
  >({})
  const [raceError, setRaceError] = React.useState<string | null>(null)

  // ── Reset when dialog closes ──────────────────────────────────────────────
  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setFields(EMPTY_FIELDS)
      setFieldErrors({})
      setRaceError(null)
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errors: Partial<Record<keyof FormFields, string>> = {}
    if (!fields.pasajero) errors.pasajero = "Seleccioná o creá un pasajero"
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!asiento || !validate()) return

    setRaceError(null)
    setSaving(true)
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vuelo_id: vueloId,
          asiento_id: asiento.dbId,
          pasajero: {
            nombre: fields.pasajero!.nombre,
            documento: fields.pasajero!.documento,
          },
        }),
      })

      if (res.status === 201) {
        router.refresh()
        handleOpenChange(false)
        toast.success(`Asiento ${asiento.numero} reservado exitosamente`)
        return
      }

      // 409 — seat was taken while filling the form (race condition)
      if (res.status === 409) {
        const body: { code?: string } = await res.json()
        if (body.code === "ASIENTO_OCUPADO") {
          setRaceError(
            "El asiento fue reservado mientras completabas el formulario. Volvé al mapa y elegí otro.",
          )
          return
        }
      }

      // Other errors
      let errorMsg = "No se pudo crear la reserva. Intentá nuevamente."
      try {
        const body: { error?: string } = await res.json()
        if (body.error) errorMsg = body.error
      } catch {
        // ignore parse error, use default message
      }
      toast.error(errorMsg)
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá nuevamente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reservar asiento</DialogTitle>
        </DialogHeader>

        {/* Race condition error */}
        {raceError && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {raceError}
          </p>
        )}

        {/* Read-only seat context */}
        {asiento && (
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Asiento</dt>
                <dd className="font-mono font-semibold text-foreground">
                  {asiento.numero}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Clase</dt>
                <dd className="font-medium text-foreground capitalize">
                  {asiento.clase}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <form id="reservar-asiento-form" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-5 py-2">
            {/* Pasajero — combobox con búsqueda + creación inline */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ra-pasajero">Pasajero</Label>
              <PasajeroCombobox
                value={fields.pasajero}
                onSelect={(p) => setFields((f) => ({ ...f, pasajero: p }))}
                disabled={saving}
                describedBy={fieldErrors.pasajero ? "ra-pasajero-error" : undefined}
                invalid={!!fieldErrors.pasajero}
              />
              {fieldErrors.pasajero && (
                <span
                  id="ra-pasajero-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.pasajero}
                </span>
              )}
            </div>
          </div>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={saving} />}>
            Cancelar
          </DialogClose>
          <Button
            type="submit"
            form="reservar-asiento-form"
            disabled={saving || !asiento}
            className="min-w-28"
          >
            {saving ? "Reservando…" : "Confirmar reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
