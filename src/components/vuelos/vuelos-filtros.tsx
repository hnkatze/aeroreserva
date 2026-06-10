"use client"

import { useState } from "react"
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

// Aeropuertos de la región — MOCK: reemplazar con lookup de DB
const AEROPUERTOS = [
  { code: "EZE", label: "EZE — Buenos Aires (Ezeiza)" },
  { code: "AEP", label: "AEP — Buenos Aires (Aeroparque)" },
  { code: "GRU", label: "GRU — São Paulo (Guarulhos)" },
  { code: "SCL", label: "SCL — Santiago de Chile" },
  { code: "BOG", label: "BOG — Bogotá" },
  { code: "MDE", label: "MDE — Medellín" },
  { code: "LIM", label: "LIM — Lima" },
  { code: "PTY", label: "PTY — Ciudad de Panamá" },
  { code: "GUA", label: "GUA — Ciudad de Guatemala" },
  { code: "MVD", label: "MVD — Montevideo" },
  { code: "UIO", label: "UIO — Quito" },
  { code: "CCS", label: "CCS — Caracas" },
  { code: "CUN", label: "CUN — Cancún" },
  { code: "MEX", label: "MEX — Ciudad de México" },
] as const

interface VuelosFiltrosProps {
  onBuscar?: (filtros: { origen: string; destino: string; fecha: string }) => void
}

export function VuelosFiltros({ onBuscar }: VuelosFiltrosProps) {
  const [origen, setOrigen] = useState("")
  const [destino, setDestino] = useState("")
  const [fecha, setFecha] = useState("")

  function handleBuscar() {
    onBuscar?.({ origen, destino, fecha })
  }

  return (
    <Card>
      <CardContent className="px-5 py-4">
        <form
          onSubmit={(e) => { e.preventDefault(); handleBuscar() }}
          aria-label="Filtros de búsqueda de vuelos"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            {/* Origen */}
            <div className="flex flex-col gap-1.5 sm:w-52">
              <Label htmlFor="filtro-origen" className="text-xs font-medium text-muted-foreground">
                Origen
              </Label>
              <Select value={origen} onValueChange={(v) => setOrigen(v ?? "")}>
                <SelectTrigger id="filtro-origen" className="h-9 text-sm">
                  <SelectValue placeholder="Seleccioná origen" />
                </SelectTrigger>
                <SelectContent>
                  {AEROPUERTOS.map((a) => (
                    <SelectItem key={a.code} value={a.code}>
                      {a.label}
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
              <Select value={destino} onValueChange={(v) => setDestino(v ?? "")}>
                <SelectTrigger id="filtro-destino" className="h-9 text-sm">
                  <SelectValue placeholder="Seleccioná destino" />
                </SelectTrigger>
                <SelectContent>
                  {AEROPUERTOS.map((a) => (
                    <SelectItem key={a.code} value={a.code}>
                      {a.label}
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
