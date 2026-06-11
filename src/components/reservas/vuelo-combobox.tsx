"use client"

import * as React from "react"
import { ChevronDownIcon, Loader2Icon, PlaneIcon, SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { EstadoVuelo } from "@/lib/vuelos"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VueloOption {
  id: number
  codigo: string
  origen: string
  destino: string
  origen_ciudad: string
  destino_ciudad: string
  salida: string
  estado: EstadoVuelo
  aerolinea_nombre: string | null
}

interface VueloComboboxProps {
  value: string | null
  onSelect: (vuelo: VueloOption | null) => void
  disabled?: boolean
  /** aria-describedby id to link error messages */
  describedBy?: string
  /** Sets aria-invalid on the trigger */
  invalid?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estadoVariant(
  estado: EstadoVuelo,
): "default" | "secondary" | "destructive" | "outline" {
  switch (estado) {
    case "programado":
      return "secondary"
    case "abordando":
      return "default"
    case "despegado":
      return "outline"
    case "aterrizado":
      return "outline"
    case "retrasado":
      return "destructive"
    case "cancelado":
      return "destructive"
    default:
      return "secondary"
  }
}

function formatSalida(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return isoString
  }
}

// ---------------------------------------------------------------------------
// VueloCombobox
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 250

export function VueloCombobox({
  value,
  onSelect,
  disabled,
  describedBy,
  invalid,
}: VueloComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<VueloOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [activeIndex, setActiveIndex] = React.useState(-1)

  // Cache of id → vuelo so the trigger can display the selected item label
  // even when the results list has been cleared (e.g. after closing the popup).
  const vueloCache = React.useRef<Map<string, VueloOption>>(new Map())

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const listboxRef = React.useRef<HTMLUListElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const listboxId = React.useId()
  const inputId = React.useId()

  // ── Populate cache from results ───────────────────────────────────────────
  React.useEffect(() => {
    for (const v of results) {
      vueloCache.current.set(String(v.id), v)
    }
  }, [results])

  // ── Fetch helper ──────────────────────────────────────────────────────────
  const fetchVuelos = React.useCallback(async (q: string) => {
    setLoading(true)
    setFetchError(null)
    try {
      const url = q
        ? `/api/vuelos?q=${encodeURIComponent(q)}&limit=20`
        : "/api/vuelos?limit=20"
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { vuelos: VueloOption[] } = await res.json()
      setResults(data.vuelos)
      setActiveIndex(-1)
    } catch {
      setFetchError("No se pudieron cargar los vuelos.")
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Debounced search on query change ──────────────────────────────────────
  React.useEffect(() => {
    if (!open) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchVuelos(query)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, fetchVuelos])

  // ── Close on outside pointer-down ────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return

    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeDropdown()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [open])

  // ── Scroll active item into view ──────────────────────────────────────────
  React.useEffect(() => {
    if (activeIndex < 0) return
    const li = listboxRef.current?.children[activeIndex] as
      | HTMLElement
      | undefined
    li?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  // ── Input ref callback — auto-focus when dropdown opens ──────────────────
  const setInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      if (node && open) {
        node.focus()
      }
    },
    [open],
  )

  // ── Handlers ──────────────────────────────────────────────────────────────
  function openDropdown() {
    if (disabled) return
    setOpen(true)
    setQuery("")
    setResults([])
    setActiveIndex(-1)
    // Load initial results; invoked here (user event) not in an effect
    void fetchVuelos("")
  }

  function closeDropdown() {
    setOpen(false)
    setQuery("")
    triggerRef.current?.focus()
  }

  function selectVuelo(vuelo: VueloOption) {
    vueloCache.current.set(String(vuelo.id), vuelo)
    onSelect(vuelo)
    closeDropdown()
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault()
      closeDropdown()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      if (activeIndex >= 0 && results[activeIndex]) {
        selectVuelo(results[activeIndex])
      }
      return
    }
    if (e.key === "Tab") {
      closeDropdown()
    }
  }

  // ── Derived display ──────────────────────────────────────────────────────
  const selectedVuelo = value ? (vueloCache.current.get(value) ?? null) : null
  const triggerLabel = selectedVuelo
    ? `${selectedVuelo.codigo} — ${selectedVuelo.origen_ciudad} → ${selectedVuelo.destino_ciudad}`
    : "Buscá un vuelo…"

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Trigger button ─────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        disabled={disabled}
        onClick={openDropdown}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          "dark:bg-input/30 dark:hover:bg-input/50",
          !selectedVuelo && "text-muted-foreground",
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {/* ── Dropdown ───────────────────────────────────────────────────── */}
      {open && (
        <div
          className={cn(
            "absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[22rem]",
            "rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
            "overflow-hidden",
          )}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <SearchIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={setInputRef}
              id={inputId}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={
                activeIndex >= 0
                  ? `${listboxId}-item-${activeIndex}`
                  : undefined
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Código, origen o destino…"
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && (
              <Loader2Icon
                className="size-4 shrink-0 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </div>

          {/* Results list */}
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label="Vuelos disponibles"
            className="max-h-72 overflow-y-auto py-1"
          >
            {loading && results.length === 0 && (
              <li
                role="option"
                aria-selected="false"
                aria-disabled="true"
                className="px-3 py-3 text-sm text-muted-foreground"
              >
                Buscando vuelos…
              </li>
            )}

            {!loading && fetchError && (
              <li
                role="option"
                aria-selected="false"
                aria-disabled="true"
                className="px-3 py-3 text-sm text-destructive"
              >
                {fetchError}
              </li>
            )}

            {!loading && !fetchError && results.length === 0 && (
              <li
                role="option"
                aria-selected="false"
                aria-disabled="true"
                className="px-3 py-3 text-sm text-muted-foreground"
              >
                {query
                  ? `Sin resultados para «${query}»`
                  : "Escribí para buscar vuelos"}
              </li>
            )}

            {results.map((vuelo, idx) => {
              const isActive = idx === activeIndex
              const isSelected = String(vuelo.id) === value

              return (
                <li
                  key={vuelo.id}
                  id={`${listboxId}-item-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectVuelo(vuelo)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 px-3 py-2.5 text-sm transition-colors",
                    isActive && "bg-accent text-accent-foreground",
                    isSelected && !isActive && "bg-accent/40",
                  )}
                >
                  {/* Row 1: code + status badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold tracking-wide">
                      {vuelo.codigo}
                    </span>
                    <Badge variant={estadoVariant(vuelo.estado)}>
                      {vuelo.estado}
                    </Badge>
                  </div>

                  {/* Row 2: route — cities with IATA codes */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <PlaneIcon className="size-3 shrink-0" aria-hidden="true" />
                    <span>
                      {vuelo.origen_ciudad} ({vuelo.origen}) → {vuelo.destino_ciudad} ({vuelo.destino})
                    </span>
                  </div>

                  {/* Row 3: departure + airline */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatSalida(vuelo.salida)}</span>
                    {vuelo.aerolinea_nombre && (
                      <span className="truncate pl-2 text-right">
                        {vuelo.aerolinea_nombre}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Clear selection footer (only when something is selected) */}
          {selectedVuelo && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  onSelect(null)
                  closeDropdown()
                }}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Quitar selección
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
