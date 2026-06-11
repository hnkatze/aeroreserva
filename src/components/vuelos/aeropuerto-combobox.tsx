"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronDownIcon, SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Aeropuerto } from "@/lib/aeropuertos"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AeropuertoComboboxProps {
  aeropuertos: readonly Aeropuerto[]
  value: string                              // selected IATA code; "" = no selection
  onChange: (codigo: string) => void         // "" when "all" option is chosen
  placeholder?: string                       // e.g. "Todos los orígenes"
  id?: string                                // pairs with an external <label htmlFor>
  describedBy?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RESULTS = 50

// ---------------------------------------------------------------------------
// AeropuertoCombobox
// ---------------------------------------------------------------------------

export function AeropuertoCombobox({
  aeropuertos,
  value,
  onChange,
  placeholder = "Todos los aeropuertos",
  id,
  describedBy,
}: AeropuertoComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  // activeIndex 0 = "all" option; 1..n = filtered airports at index - 1
  const [activeIndex, setActiveIndex] = React.useState(-1)

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const listboxRef = React.useRef<HTMLUListElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Fixed-position coordinates for the portalled dropdown, so it escapes any
  // ancestor with overflow-hidden (e.g. the filters Card).
  const [position, setPosition] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const listboxId = React.useId()

  // ── Position the dropdown under the trigger (viewport coords) ─────────────
  const updatePosition = React.useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPosition({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filtered = React.useMemo<readonly Aeropuerto[]>(() => {
    if (!query.trim()) return aeropuertos.slice(0, MAX_RESULTS)
    const q = query.trim().toLowerCase()
    const matches = aeropuertos.filter(
      (a) =>
        a.ciudad.toLowerCase().includes(q) ||
        a.codigo.toLowerCase().includes(q),
    )
    return matches.slice(0, MAX_RESULTS)
  }, [aeropuertos, query])

  // Total option count: 1 "all" option + filtered airports
  const totalOptions = filtered.length + 1

  // ── Close on outside pointer-down (account for the portalled dropdown) ────
  React.useEffect(() => {
    if (!open) return

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node
      const insideTrigger = containerRef.current?.contains(target) ?? false
      const insideDropdown = dropdownRef.current?.contains(target) ?? false
      if (!insideTrigger && !insideDropdown) closeDropdown()
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [open])

  // ── Keep the portalled dropdown glued to the trigger on scroll/resize ────
  React.useEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [open, updatePosition])

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
    updatePosition()
    setOpen(true)
    setQuery("")
    setActiveIndex(-1)
  }

  function closeDropdown() {
    setOpen(false)
    setQuery("")
    triggerRef.current?.focus()
  }

  function selectOption(codigo: string) {
    onChange(codigo)
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
      setActiveIndex((i) => Math.min(i + 1, totalOptions - 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      if (activeIndex === 0) {
        // "all" option
        selectOption("")
      } else if (activeIndex >= 1) {
        const airport = filtered[activeIndex - 1]
        if (airport) selectOption(airport.codigo)
      }
      return
    }
    if (e.key === "Tab") {
      closeDropdown()
    }
  }

  // ── Derived display ───────────────────────────────────────────────────────
  const selectedAirport = value
    ? aeropuertos.find((a) => a.codigo === value) ?? null
    : null

  const triggerLabel = selectedAirport
    ? `${selectedAirport.ciudad} (${selectedAirport.codigo})`
    : placeholder

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Trigger button ─────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-describedby={describedBy}
        onClick={openDropdown}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "dark:bg-input/30 dark:hover:bg-input/50",
          !selectedAirport && "text-muted-foreground",
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

      {/* ── Dropdown — portalled to body so the Card's overflow can't clip it ── */}
      {open &&
        position &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            className={cn(
              "z-50 min-w-[18rem]",
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
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIndex(-1)
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Ciudad o código IATA…"
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Options list */}
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label="Aeropuertos disponibles"
            className="max-h-64 overflow-y-auto py-1"
          >
            {/* "All" option — always first */}
            <li
              id={`${listboxId}-item-0`}
              role="option"
              aria-selected={value === ""}
              onClick={() => selectOption("")}
              onMouseEnter={() => setActiveIndex(0)}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors",
                activeIndex === 0 && "bg-accent text-accent-foreground",
                value === "" && activeIndex !== 0 && "bg-accent/40",
              )}
            >
              <span className="text-muted-foreground">{placeholder}</span>
            </li>

            {/* Filtered airport options */}
            {filtered.length === 0 && query.trim() !== "" && (
              <li
                role="option"
                aria-selected="false"
                aria-disabled="true"
                className="px-3 py-3 text-sm text-muted-foreground"
              >
                Sin resultados para «{query}»
              </li>
            )}

            {filtered.map((airport, idx) => {
              const optionIndex = idx + 1 // offset by 1 for the "all" option
              const isActive = optionIndex === activeIndex
              const isSelected = airport.codigo === value

              return (
                <li
                  key={airport.codigo}
                  id={`${listboxId}-item-${optionIndex}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectOption(airport.codigo)}
                  onMouseEnter={() => setActiveIndex(optionIndex)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors",
                    isActive && "bg-accent text-accent-foreground",
                    isSelected && !isActive && "bg-accent/40",
                  )}
                >
                  <span className="font-medium">{airport.ciudad}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {airport.codigo}
                  </span>
                </li>
              )
            })}
          </ul>
          </div>,
          document.body,
        )}
    </div>
  )
}
