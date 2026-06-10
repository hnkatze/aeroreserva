"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import type { Aeropuerto } from "@/lib/aeropuertos"

// Sentinel value used to represent "no selection" in the Select component.
// An empty string triggers the placeholder but shadcn/radix Select requires a
// non-empty string as the value for controlled mode; we use this constant and
// translate it back to "" before building the URL.
const NO_FILTER = "_all_"

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
  const [origen, setOrigen] = useState(initialOrigen || NO_FILTER)
  const [destino, setDestino] = useState(initialDestino || NO_FILTER)
  const [fecha, setFecha] = useState(initialFecha)

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (origen && origen !== NO_FILTER) params.set("origen", origen)
    if (destino && destino !== NO_FILTER) params.set("destino", destino)
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
            <div className="flex flex-col gap-1.5 sm:w-52">
              <Label htmlFor="filtro-origen" className="text-xs font-medium text-muted-foreground">
                Origen
              </Label>
              <Select value={origen} onValueChange={(v) => setOrigen(v ?? NO_FILTER)}>
                <SelectTrigger id="filtro-origen" className="h-9 text-sm">
                  <SelectValue placeholder="Todos los orígenes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FILTER}>Todos los orígenes</SelectItem>
                  {aeropuertos.map((a) => (
                    <SelectItem key={a.codigo} value={a.codigo}>
                      {a.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Destino */}
            <div className="flex flex-col gap-1.5 sm:w-52">
              <Label htmlFor="filtro-destino" className="text-xs font-medium text-muted-foreground">
                Destino
              </Label>
              <Select value={destino} onValueChange={(v) => setDestino(v ?? NO_FILTER)}>
                <SelectTrigger id="filtro-destino" className="h-9 text-sm">
                  <SelectValue placeholder="Todos los destinos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FILTER}>Todos los destinos</SelectItem>
                  {aeropuertos.map((a) => (
                    <SelectItem key={a.codigo} value={a.codigo}>
                      {a.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                className="h-9 text-sm"
              />
            </div>

            {/* Botón buscar */}
            <Button type="submit" className="h-9 shrink-0 gap-2 sm:self-end">
              <SearchIcon className="h-4 w-4" aria-hidden="true" />
              Buscar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
