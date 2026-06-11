"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { VueloCombobox, type VueloOption } from "@/components/reservas/vuelo-combobox"
import {
  PasajeroCombobox,
  type PasajeroSeleccion,
} from "@/components/pasajeros/pasajero-combobox"

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  vueloId: string
  pasajero: PasajeroSeleccion | null
}

const EMPTY_FORM: FormState = {
  vueloId: "",
  pasajero: null,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EncolarEsperaDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<keyof FormState, string>>
  >({})
  const [duplicateError, setDuplicateError] = React.useState<string | null>(null)

  // ── Reset all state when the dialog closes ──────────────────────────────
  function resetForm() {
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setDuplicateError(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetForm()
  }

  function handleVueloSelect(vuelo: VueloOption | null) {
    const vueloId = vuelo ? String(vuelo.id) : ""
    setForm((f) => ({ ...f, vueloId }))
    setDuplicateError(null)
  }

  // ── Validation ───────────────────────────────────────────────────────────
  function validate(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {}
    if (!form.vueloId) errors.vueloId = "Seleccioná un vuelo"
    if (!form.pasajero) errors.pasajero = "Seleccioná o creá un pasajero"
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setDuplicateError(null)
    setSaving(true)
    try {
      const res = await fetch("/api/lista-espera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vuelo_id: Number(form.vueloId),
          pasajero: {
            nombre: form.pasajero!.nombre,
            documento: form.pasajero!.documento,
          },
        }),
      })

      if (res.status === 201) {
        router.refresh()
        handleOpenChange(false)
        toast.success("Pasajero agregado a la lista de espera")
        return
      }

      // 409 — passenger is already on the waitlist for this flight
      if (res.status === 409) {
        const body: { code?: string; error?: string } = await res.json()
        if (body.code === "YA_EN_ESPERA") {
          setDuplicateError(
            "Este pasajero ya está en la lista de espera para este vuelo.",
          )
          return
        }
      }

      // Other errors
      let errorMsg = "No se pudo agregar el pasajero. Intentá nuevamente."
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

  const isFormDisabled = saving

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" />
        }
      >
        <PlusIcon className="h-4 w-4" aria-hidden="true" />
        Encolar pasajero
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Encolar pasajero en lista de espera</DialogTitle>
        </DialogHeader>

        {/* Duplicate error — persists until user changes flight or document */}
        {duplicateError && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {duplicateError}
          </p>
        )}

        <form id="espera-form" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-5 py-2">
            {/* Vuelo — combobox con búsqueda server-side */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="esp-vuelo">Vuelo</Label>
              <VueloCombobox
                value={form.vueloId}
                onSelect={handleVueloSelect}
                disabled={isFormDisabled}
                describedBy={fieldErrors.vueloId ? "esp-vuelo-error" : undefined}
                invalid={!!fieldErrors.vueloId}
              />
              {fieldErrors.vueloId && (
                <span
                  id="esp-vuelo-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.vueloId}
                </span>
              )}
            </div>

            {/* Pasajero — combobox con búsqueda + creación inline */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="esp-pasajero">Pasajero</Label>
              <PasajeroCombobox
                value={form.pasajero}
                onSelect={(p) => {
                  setForm((f) => ({ ...f, pasajero: p }))
                  setDuplicateError(null)
                }}
                disabled={isFormDisabled}
                describedBy={fieldErrors.pasajero ? "esp-pasajero-error" : undefined}
                invalid={!!fieldErrors.pasajero}
              />
              {fieldErrors.pasajero && (
                <span
                  id="esp-pasajero-error"
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
            form="espera-form"
            disabled={isFormDisabled}
            className="min-w-28"
          >
            {saving ? "Guardando…" : "Encolar pasajero"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
