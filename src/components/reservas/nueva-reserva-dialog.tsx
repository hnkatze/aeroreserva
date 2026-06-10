"use client"

import * as React from "react"
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

// MOCK — flight options for the select
const VUELOS_MOCK = [
  { id: "AR1204", label: "AR1204 — BUE → MIA (10:30)" },
  { id: "AR0850", label: "AR0850 — BUE → SCL (08:15)" },
  { id: "LA5502", label: "LA5502 — BUE → GRU (14:00)" },
  { id: "AA7731", label: "AA7731 — BUE → JFK (22:45)" },
  { id: "IB6612", label: "IB6612 — BUE → MAD (23:55)" },
] as const

// MOCK — seat options for the select
const ASIENTOS_MOCK = [
  "1A", "1B", "2C", "3D", "4A", "5B", "6C", "7A", "8D", "9E",
  "10F", "11A", "12C", "15B", "18A", "22D",
] as const

interface FormState {
  vuelo: string
  nombre: string
  documento: string
  asiento: string
}

const EMPTY_FORM: FormState = {
  vuelo: "",
  nombre: "",
  documento: "",
  asiento: "",
}

export function NuevaReservaDialog() {
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<keyof FormState, string>>
  >({})

  // Reset form on open
  React.useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setFieldErrors({})
    }
  }, [open])

  function validate(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {}
    if (!form.vuelo) errors.vuelo = "Seleccioná un vuelo"
    if (!form.nombre.trim()) errors.nombre = "El nombre es requerido"
    if (!form.documento.trim()) errors.documento = "El documento es requerido"
    if (!form.asiento) errors.asiento = "Seleccioná un asiento"
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    // MOCK — simulate async save
    setTimeout(() => {
      setSaving(false)
      setOpen(false)
      toast.success("Reserva creada (demo)")
    }, 600)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" />
        }
      >
        <PlusIcon className="h-4 w-4" aria-hidden="true" />
        Nueva reserva
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva reserva</DialogTitle>
        </DialogHeader>

        <form id="reserva-form" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-4 py-2">
            {/* Vuelo */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rsv-vuelo">Vuelo</Label>
              <Select
                value={form.vuelo}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, vuelo: value ?? "" }))
                }
                disabled={saving}
              >
                <SelectTrigger
                  id="rsv-vuelo"
                  className="w-full"
                  aria-describedby={
                    fieldErrors.vuelo ? "rsv-vuelo-error" : undefined
                  }
                  aria-invalid={fieldErrors.vuelo ? true : undefined}
                >
                  <SelectValue placeholder="Seleccioná un vuelo" />
                </SelectTrigger>
                <SelectContent>
                  {VUELOS_MOCK.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.vuelo && (
                <span
                  id="rsv-vuelo-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.vuelo}
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
                disabled={saving}
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
                disabled={saving}
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
                value={form.asiento}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, asiento: value ?? "" }))
                }
                disabled={saving}
              >
                <SelectTrigger
                  id="rsv-asiento"
                  className="w-full font-mono"
                  aria-describedby={
                    fieldErrors.asiento ? "rsv-asiento-error" : undefined
                  }
                  aria-invalid={fieldErrors.asiento ? true : undefined}
                >
                  <SelectValue placeholder="Seleccioná un asiento" />
                </SelectTrigger>
                <SelectContent>
                  {ASIENTOS_MOCK.map((seat) => (
                    <SelectItem key={seat} value={seat} className="font-mono">
                      {seat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.asiento && (
                <span
                  id="rsv-asiento-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.asiento}
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
            disabled={saving}
            className="min-w-28"
          >
            {saving ? "Creando…" : "Crear reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
