import { listarOperadores } from "@/lib/operadores";
import { UsuariosTable } from "@/components/usuarios/usuarios-table";
import { OperadorFormDialog } from "@/components/usuarios/operador-form-dialog";

export default async function UsuariosPage() {
  const operadores = await listarOperadores();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">
            Usuarios
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestioná los operadores del sistema
          </p>
        </div>
        <OperadorFormDialog />
      </div>

      <UsuariosTable operadores={operadores} />
    </div>
  );
}
