import { Network } from "lucide-react";
import { obtenerEsquema } from "@/lib/esquema";
import { ErDiagram } from "@/components/esquema/er-diagram";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Modelo de datos",
  description:
    "Diagrama ER interactivo generado en vivo desde el catálogo de PostgreSQL.",
};

export default async function EsquemaPage() {
  const esquema = await obtenerEsquema();

  const tableCount = esquema.tablas.length;
  const relCount = esquema.relaciones.length;

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header */}
      <header className="flex items-start gap-3">
        <Network
          className="mt-1 h-7 w-7 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Modelo de datos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esquema relacional generado en vivo desde el catálogo de PostgreSQL
            &mdash;{" "}
            <span className="font-medium text-foreground">
              {tableCount} tablas
            </span>
            ,{" "}
            <span className="font-medium text-foreground">
              {relCount} relaciones
            </span>
            .
          </p>
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <ErDiagram esquema={esquema} />
      </div>
    </div>
  );
}
