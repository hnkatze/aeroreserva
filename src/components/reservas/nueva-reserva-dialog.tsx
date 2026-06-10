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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VueloCombobox, type VueloOption } from "@/components/reservas/vuelo-combobox"

// ---------------------------------------------------------------------------
// API response DTOs — mirrors exactly what the route handlers return
// ---------------------------------------------------------------------------

interface AsientoDto {
  id: number
  numero: string
  clase: string
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  vueloId: string
  nombre: string
  documento: string
  asientoId: string
}

const EMPTY_FORM: FormState = {
  vueloId: "",
  nombre: "",
  documento: "",
  asientoId: "",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NuevaReservaDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<keyof FormState, string>>
  >({})
  const [raceError, setRaceError] = React.useState<string | null>(null)

  const [asientos, setAsientos] = React.useState<AsientoDto[]>([])
  const [loadingAsientos, setLoadingAsientos] = React.useState(false)

  // ── Reset all state when the dialog closes ──────────────────────────────
  function resetForm() {
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setRaceError(null)
    setAsientos([])
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetForm()
  }

  // ── Fetch asientos when a vuelo is selected ──────────────────────────────
  async function fetchAsientosLibres(vueloId: string) {
    setAsientos([])
    setForm((f) => ({ ...f, asientoId: "" }))
    setLoadingAsientos(true)
    try {
      const res = await fetch(
        `/api/vuelos/${vueloId}/asientos?soloLibres=true`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { asientos: AsientoDto[] } = await res.json()
      setAsientos(data.asientos)
    } catch {
      // Non-blocking — the asiento select will just be empty
      setAsientos([])
    } finally {
      setLoadingAsientos(false)
    }
  }

  function handleVueloSelect(vuelo: VueloOption | null) {
    const vueloId = vuelo ? String(vuelo.id) : ""
    setForm((f) => ({ ...f, vueloId, asientoId: "" }))
    setRaceError(null)
    if (vuelo) void fetchAsientosLibres(vueloId)
    else setAsientos([])
  }

  // ── Validation ───────────────────────────────────────────────────────────
  function validate(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {}
    if (!form.vueloId) errors.vueloId = "Seleccioná un vuelo"
    if (!form.nombre.trim()) errors.nombre = "El nombre es requerido"
    if (!form.documento.trim()) errors.documento = "El documento es requerido"
    if (!form.asientoId) errors.asientoId = "Seleccioná un asiento"
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setRaceError(null)
    setSaving(true)
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vuelo_id: Number(form.vueloId),
          asiento_id: Number(form.asientoId),
          pasajero: {
            nombre: form.nombre.trim(),
            documento: form.documento.trim(),
          },
        }),
      })

      if (res.status === 201) {
        router.refresh()
        handleOpenChange(false)
        toast.success("Reserva creada exitosamente")
        return
      }

      // 409 — race condition: seat was taken while filling the form
      if (res.status === 409) {
        const body: { code?: string } = await res.json()
        if (body.code === "ASIENTO_OCUPADO") {
          setRaceError(
            "El asiento fue reservado mientras completabas el formulario. Elegí otro.",
          )
          // Re-fetch available seats for the same flight (do NOT close)
          void fetchAsientosLibres(form.vueloId)
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

  const isFormDisabled = saving

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" />
        }
      >
        <PlusIcon className="h-4 w-4" aria-hidden="true" />
        Nueva reserva
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva reserva</DialogTitle>
        </DialogHeader>

        {/* Race condition error — persists until user picks another seat */}
        {raceError && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {raceError}
          </p>
        )}

        <form id="reserva-form" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-5 py-2">
            {/* Vuelo — combobox con búsqueda server-side */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rsv-vuelo">Vuelo</Label>
              <VueloCombobox
                value={form.vueloId}
                onSelect={handleVueloSelect}
                disabled={isFormDisabled}
                describedBy={fieldErrors.vueloId ? "rsv-vuelo-error" : undefined}
                invalid={!!fieldErrors.vueloId}
              />
              {fieldErrors.vueloId && (
                <span
                  id="rsv-vuelo-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.vueloId}
                </span>
              )}
            </div>

            {/* Nombre pasajero */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rsv-nombre">Nombre del pasajero</Label>
              <Input
                id="rsv-nombre"
                type="text"
                placeholder="ej. María García"
                value={form.nombre}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nombre: e.target.value }))
                }
                aria-describedby={
                  fieldErrors.nombre ? "rsv-nombre-error" : undefined
                }
                aria-invalid={fieldErrors.nombre ? true : undefined}
                disabled={isFormDisabled}
              />
              {fieldErrors.nombre && (
                <span
                  id="rsv-nombre-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.nombre}
                </span>
              )}
            </div>

            {/* Documento */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rsv-documento">Documento (DNI / Pasaporte)</Label>
              <Input
                id="rsv-documento"
                type="text"
                placeholder="ej. 30456789"
                value={form.documento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, documento: e.target.value }))
                }
                aria-describedby={
                  fieldErrors.documento ? "rsv-documento-error" : undefined
                }
                aria-invalid={fieldErrors.documento ? true : undefined}
                disabled={isFormDisabled}
              />
              {fieldErrors.documento && (
                <span
                  id="rsv-documento-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.documento}
                </span>
              )}
            </div>

            {/* Asiento */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rsv-asiento">Asiento</Label>
              <Select
                value={form.asientoId}
                onValueChange={(value: string | null) =>
                  setForm((f) => ({ ...f, asientoId: value ?? "" }))
                }
                disabled={isFormDisabled || !form.vueloId || loadingAsientos}
              >
                <SelectTrigger
                  id="rsv-asiento"
                  className="h-10 w-full font-mono"
                  aria-describedby={
                    fieldErrors.asientoId ? "rsv-asiento-error" : undefined
                  }
                  aria-invalid={fieldErrors.asientoId ? true : undefined}
                >
                  <SelectValue
                    placeholder={
                      !form.vueloId
                        ? "Primero seleccioná un vuelo"
                        : loadingAsientos
                          ? "Cargando asientos…"
                          : asientos.length === 0
                            ? "Sin asientos disponibles"
                            : "Seleccioná un asiento"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {asientos.map((a) => (
                    <SelectItem
                      key={a.id}
                      value={String(a.id)}
                      className="py-2.5 font-mono"
                    >
                      {`${a.numero} — ${a.clase}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.asientoId && (
                <span
                  id="rsv-asiento-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.asientoId}
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
            form="reserva-form"
            disabled={isFormDisabled}
            className="min-w-28"
          >
            {saving ? "Creando…" : "Crear reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
