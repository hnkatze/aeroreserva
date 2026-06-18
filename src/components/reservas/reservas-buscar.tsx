"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { SearchIcon, XIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface ReservasBuscarProps {
  /** Current search term from the URL (so the input stays in sync on reload). */
  valorInicial: string
}

/**
 * Server-side search box for reservations. Submitting navigates to `?q=<term>`,
 * which the page reads and forwards to listarReservas. Searching always resets
 * to page 1 because `page` is not carried over.
 */
export function ReservasBuscar({ valorInicial }: ReservasBuscarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [valor, setValor] = useState(valorInicial)

  function buscar(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const q = valor.trim()
    router.push(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname)
  }

  function limpiar(): void {
    setValor("")
    router.push(pathname)
  }

  return (
    <form
      role="search"
      onSubmit={buscar}
      className="flex w-full items-end gap-2 sm:max-w-md"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Label
          htmlFor="reservas-buscar"
          className="text-xs font-medium text-muted-foreground"
        >
          Buscar pasajero
        </Label>
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="reservas-buscar"
            type="search"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Nombre o documento…"
            className="h-9 pl-8"
          />
        </div>
      </div>
      <Button type="submit" variant="secondary" size="sm" className="h-9">
        Buscar
      </Button>
      {valorInicial && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={limpiar}
        >
          <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Limpiar
        </Button>
      )}
    </form>
  )
}
