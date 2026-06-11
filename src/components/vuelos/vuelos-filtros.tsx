"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { AeropuertoCombobox } from "@/components/vuelos/aeropuerto-combobox"
import type { Aeropuerto } from "@/lib/aeropuertos"

interface VuelosFiltrosProps {
  aeropuertos: Aeropuerto[]
  initialOrigen?: string
  initialDestino?: string
  initialFecha?: string
}

export function VuelosFiltros({
  aeropuertos,
  initialOrigen = "",
  initialDestino = "",
  initialFecha = "",
}: VuelosFiltrosProps) {
  const router = useRouter()
  const [origen, setOrigen] = useState(initialOrigen)
  const [destino, setDestino] = useState(initialDestino)
  const [fecha, setFecha] = useState(initialFecha)

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (origen) params.set("origen", origen)
    if (destino) params.set("destino", destino)
    if (fecha) params.set("fecha", fecha)
    params.set("page", "1")
    router.push(`/vuelos?${params.toString()}`)
  }

  return (
    <Card>
      <CardContent className="px-5 py-4">
        <form
          onSubmit={handleBuscar}
          aria-label="Filtros de búsqueda de vuelos"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            {/* Origen */}
            <div className="flex flex-col gap-1.5 sm:w-64">
              <Label htmlFor="filtro-origen" className="text-xs font-medium text-muted-foreground">
                Origen
              </Label>
              <AeropuertoCombobox
                aeropuertos={aeropuertos}
                value={origen}
                onChange={setOrigen}
                placeholder="Todos los orígenes"
                id="filtro-origen"
              />
            </div>

            {/* Destino */}
            <div className="flex flex-col gap-1.5 sm:w-64">
              <Label htmlFor="filtro-destino" className="text-xs font-medium text-muted-foreground">
                Destino
              </Label>
              <AeropuertoCombobox
                aeropuertos={aeropuertos}
                value={destino}
                onChange={setDestino}
                placeholder="Todos los destinos"
                id="filtro-destino"
              />
            </div>

            {/* Fecha */}
            <div className="flex flex-col gap-1.5 sm:w-44">
              <Label htmlFor="filtro-fecha" className="text-xs font-medium text-muted-foreground">
                Fecha
              </Label>
              <Input
                id="filtro-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            {/* Botón buscar */}
            <Button type="submit" className="h-10 shrink-0 gap-2 sm:self-end">
              <SearchIcon className="h-4 w-4" aria-hidden="true" />
              Buscar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
