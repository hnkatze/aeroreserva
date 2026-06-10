"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Operador } from "@/lib/operadores";

interface EliminarOperadorDialogProps {
  operador: Operador;
}

export function EliminarOperadorDialog({
  operador,
}: EliminarOperadorDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/operadores/${operador.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        toast.error(data.error ?? "No se pudo eliminar el operador");
        setOpen(false);
        return;
      }

      toast.success(`Operador "${operador.username}" eliminado`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar operador ${operador.username}`}
          />
        }
      >
        <Trash2Icon
          className="h-4 w-4 text-destructive"
          aria-hidden="true"
        />
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar operador?</AlertDialogTitle>
          <AlertDialogDescription>
            Estás por eliminar al operador{" "}
            <strong className="font-semibold text-foreground">
              {operador.username}
            </strong>
            . Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
