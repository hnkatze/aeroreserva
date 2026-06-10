"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Operador } from "@/lib/operadores";
import type { OperatorRole } from "@/lib/auth";

interface OperadorFormDialogProps {
  /** When provided, the dialog is in edit mode. */
  operador?: Operador;
}

interface FormState {
  username: string;
  password: string;
  role: OperatorRole;
  activo: "true" | "false";
}

const ROLE_LABELS: Record<OperatorRole, string> = {
  admin: "Administrador",
  agente: "Agente",
  consulta: "Consulta",
};

export function OperadorFormDialog({ operador }: OperadorFormDialogProps) {
  const router = useRouter();
  const isEdit = operador !== undefined;

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<FormState>({
    username: operador?.username ?? "",
    password: "",
    role: operador?.role ?? "agente",
    activo: operador ? (operador.activo ? "true" : "false") : "true",
  });
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<keyof FormState, string>>
  >({});

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setForm({
        username: operador?.username ?? "",
        password: "",
        role: operador?.role ?? "agente",
        activo: operador ? (operador.activo ? "true" : "false") : "true",
      });
      setFieldErrors({});
    }
  }, [open, operador]);

  function validate(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.username.trim()) {
      errors.username = "El nombre de usuario es requerido";
    }
    if (!isEdit && form.password.length < 6) {
      errors.password = "La contraseña debe tener al menos 6 caracteres";
    }
    if (isEdit && form.password !== "" && form.password.length < 6) {
      errors.password = "La contraseña debe tener al menos 6 caracteres";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        username: form.username.trim(),
        role: form.role,
      };
      if (!isEdit) {
        body.password = form.password;
      } else {
        body.activo = form.activo === "true";
        if (form.password.trim() !== "") {
          body.password = form.password;
        }
      }

      const url = isEdit
        ? `/api/operadores/${operador.id}`
        : "/api/operadores";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        toast.error(data.error ?? "Ocurrió un error");
        return;
      }

      toast.success(isEdit ? "Operador actualizado" : "Operador creado");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Editar operador ${operador?.username ?? ""}`}
            />
          ) : (
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" />
          )
        }
      >
        {isEdit ? (
          <PencilIcon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <>
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Nuevo usuario
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar operador" : "Nuevo operador"}
          </DialogTitle>
        </DialogHeader>

        <form id="operador-form" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-4 py-2">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="op-username">Nombre de usuario</Label>
              <Input
                id="op-username"
                type="text"
                autoComplete="username"
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({ ...f, username: e.target.value }))
                }
                aria-describedby={
                  fieldErrors.username ? "op-username-error" : undefined
                }
                aria-invalid={fieldErrors.username ? true : undefined}
                required={!isEdit}
                aria-required={!isEdit ? true : undefined}
                disabled={saving}
                placeholder="ej. juan.perez"
              />
              {fieldErrors.username && (
                <span
                  id="op-username-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.username}
                </span>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="op-password">
                {isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}
              </Label>
              <Input
                id="op-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                aria-describedby={
                  fieldErrors.password
                    ? "op-password-hint op-password-error"
                    : "op-password-hint"
                }
                aria-invalid={fieldErrors.password ? true : undefined}
                required={!isEdit}
                aria-required={!isEdit ? true : undefined}
                disabled={saving}
                placeholder={
                  isEdit ? "Dejar en blanco para no cambiar" : ""
                }
              />
              <p id="op-password-hint" className="text-xs text-muted-foreground">
                Mínimo 6 caracteres.
              </p>
              {fieldErrors.password && (
                <span
                  id="op-password-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.password}
                </span>
              )}
            </div>

            {/* Role */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="op-role">Rol</Label>
              <Select
                value={form.role}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, role: (value ?? "agente") as OperatorRole }))
                }
                disabled={saving}
              >
                <SelectTrigger id="op-role" className="w-full">
                  <SelectValue placeholder="Seleccioná un rol" />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(ROLE_LABELS) as [OperatorRole, string][]
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado — only in edit mode */}
            {isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="op-activo">Estado</Label>
                <Select
                  value={form.activo}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      activo: ((value ?? "true") as "true" | "false"),
                    }))
                  }
                  disabled={saving}
                >
                  <SelectTrigger id="op-activo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Activo</SelectItem>
                    <SelectItem value="false">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </form>

        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" disabled={saving} />}
          >
            Cancelar
          </DialogClose>
          <Button
            type="submit"
            form="operador-form"
            disabled={saving}
            className="min-w-24"
          >
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
