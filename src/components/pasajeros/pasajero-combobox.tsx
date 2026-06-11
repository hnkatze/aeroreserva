"use client"

import * as React from "react"
import { ChevronDownIcon, Loader2Icon, SearchIcon, UserIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Pasajero } from "@/lib/pasajeros"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PasajeroSeleccion {
  documento: string
  nombre: string
}

interface PasajeroComboboxProps {
  value: PasajeroSeleccion | null
  onSelect: (pasajero: PasajeroSeleccion | null) => void
  disabled?: boolean
  /** aria-describedby id to link error messages */
  describedBy?: string
  /** Sets aria-invalid on the trigger */
  invalid?: boolean
}

// ---------------------------------------------------------------------------
// Internal mode type
// ---------------------------------------------------------------------------

type DropdownMode = "search" | "create"

// ---------------------------------------------------------------------------
// PasajeroCombobox
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 250

export function PasajeroCombobox({
  value,
  onSelect,
  disabled,
  describedBy,
  invalid,
}: PasajeroComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<DropdownMode>("search")
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<Pasajero[]>([])
  const [loading, setLoading] = React.useState(false)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [activeIndex, setActiveIndex] = React.useState(-1)

  // Create-new form state
  const [createNombre, setCreateNombre] = React.useState("")
  const [createDocumento, setCreateDocumento] = React.useState("")
  const [createErrors, setCreateErrors] = React.useState<{
    nombre?: string
    documento?: string
  }>({})

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const listboxRef = React.useRef<HTMLUListElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const listboxId = React.useId()
  const searchInputId = React.useId()
  const createNombreId = React.useId()
  const createDocumentoId = React.useId()
  const createNombreErrorId = React.useId()
  const createDocumentoErrorId = React.useId()

  // ── Fetch helper ──────────────────────────────────────────────────────────
  const fetchPasajeros = React.useCallback(async (q: string) => {
    setLoading(true)
    setFetchError(null)
    try {
      const url = `/api/pasajeros?q=${encodeURIComponent(q)}&limit=20`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { pasajeros: Pasajero[] } = await res.json()
      setResults(data.pasajeros)
      setActiveIndex(-1)
    } catch {
      setFetchError("No se pudieron cargar los pasajeros.")
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Debounced search on query change ──────────────────────────────────────
  React.useEffect(() => {
    if (!open || mode !== "search") return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchPasajeros(query)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, mode, fetchPasajeros])

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

  // ── Input ref callback — auto-focus when search mode opens ──────────────
  const setSearchInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      if (node && open && mode === "search") {
        node.focus()
      }
    },
    [open, mode],
  )

  // ── Input ref callback — auto-focus nombre when create mode opens ────────
  const setCreateNombreRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      if (node && open && mode === "create") {
        node.focus()
      }
    },
    [open, mode],
  )

  // ── Handlers ──────────────────────────────────────────────────────────────
  function openDropdown() {
    if (disabled) return
    setOpen(true)
    setMode("search")
    setQuery("")
    setResults([])
    setActiveIndex(-1)
    setCreateNombre("")
    setCreateDocumento("")
    setCreateErrors({})
    void fetchPasajeros("")
  }

  function closeDropdown() {
    setOpen(false)
    setQuery("")
    setMode("search")
    setCreateNombre("")
    setCreateDocumento("")
    setCreateErrors({})
    triggerRef.current?.focus()
  }

  function selectPasajero(p: Pasajero) {
    onSelect({ documento: p.documento, nombre: p.nombre })
    closeDropdown()
  }

  function switchToCreate() {
    // Prefill nombre from query if user typed something
    setCreateNombre(query)
    setCreateDocumento("")
    setCreateErrors({})
    setMode("create")
  }

  function switchToSearch() {
    setMode("search")
    setCreateErrors({})
    // Re-trigger search so the list is populated
    void fetchPasajeros(query)
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
        selectPasajero(results[activeIndex])
      }
      return
    }
    if (e.key === "Tab") {
      closeDropdown()
    }
  }

  // Confirm with Enter from the create-mode inputs WITHOUT bubbling to the
  // outer dialog <form> (the create UI is a <div>, not a nested form).
  function handleCreateKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      e.stopPropagation()
      handleUsarPasajeroClick()
    }
  }

  function handleUsarPasajeroClick() {
    const errors: { nombre?: string; documento?: string } = {}
    if (!createNombre.trim()) errors.nombre = "El nombre es requerido"
    if (!createDocumento.trim()) errors.documento = "El documento es requerido"
    setCreateErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSelect({ documento: createDocumento.trim(), nombre: createNombre.trim() })
    closeDropdown()
  }

  // ── Derived display ──────────────────────────────────────────────────────
  const triggerLabel = value
    ? `${value.nombre} — ${value.documento}`
    : "Buscá un pasajero…"

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
          !value && "text-muted-foreground",
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
            "absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[20rem]",
            "rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
            "overflow-hidden",
          )}
        >
          {/* ── Search mode ─────────────────────────────────────────────── */}
          {mode === "search" && (
            <>
              {/* Search input */}
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <SearchIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  ref={setSearchInputRef}
                  id={searchInputId}
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
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Documento o nombre…"
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
                aria-label="Pasajeros encontrados"
                className="max-h-64 overflow-y-auto py-1"
              >
                {loading && results.length === 0 && (
                  <li
                    role="option"
                    aria-selected="false"
                    aria-disabled="true"
                    className="px-3 py-3 text-sm text-muted-foreground"
                  >
                    Buscando pasajeros…
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
                      : "Escribí para buscar pasajeros"}
                  </li>
                )}

                {results.map((pasajero, idx) => {
                  const isActive = idx === activeIndex
                  const isSelected =
                    value?.documento === pasajero.documento

                  return (
                    <li
                      key={pasajero.id}
                      id={`${listboxId}-item-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectPasajero(pasajero)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                        isActive && "bg-accent text-accent-foreground",
                        isSelected && !isActive && "bg-accent/40",
                      )}
                    >
                      <UserIcon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium">
                          {pasajero.nombre}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {pasajero.documento}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {/* Footer — create new */}
              <div className="border-t border-border px-3 py-2">
                <button
                  type="button"
                  onClick={switchToCreate}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ＋ Crear pasajero nuevo
                </button>
              </div>
            </>
          )}

          {/* ── Create mode ─────────────────────────────────────────────── */}
          {mode === "create" && (
            <div>
              <div className="flex flex-col gap-3 px-3 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Nuevo pasajero
                </p>

                {/* Nombre */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={createNombreId}
                    className="text-xs font-medium"
                  >
                    Nombre
                  </label>
                  <input
                    ref={setCreateNombreRef}
                    id={createNombreId}
                    type="text"
                    value={createNombre}
                    onChange={(e) => {
                      setCreateNombre(e.target.value)
                      if (createErrors.nombre) {
                        setCreateErrors((prev) => ({ ...prev, nombre: undefined }))
                      }
                    }}
                    onKeyDown={handleCreateKeyDown}
                    placeholder="ej. María García"
                    aria-describedby={
                      createErrors.nombre ? createNombreErrorId : undefined
                    }
                    aria-invalid={!!createErrors.nombre}
                    className={cn(
                      "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-colors",
                      "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                      "aria-invalid:border-destructive",
                    )}
                  />
                  {createErrors.nombre && (
                    <span
                      id={createNombreErrorId}
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {createErrors.nombre}
                    </span>
                  )}
                </div>

                {/* Documento */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={createDocumentoId}
                    className="text-xs font-medium"
                  >
                    Documento
                  </label>
                  <input
                    id={createDocumentoId}
                    type="text"
                    value={createDocumento}
                    onChange={(e) => {
                      setCreateDocumento(e.target.value)
                      if (createErrors.documento) {
                        setCreateErrors((prev) => ({
                          ...prev,
                          documento: undefined,
                        }))
                      }
                    }}
                    onKeyDown={handleCreateKeyDown}
                    placeholder="ej. 30456789"
                    aria-describedby={
                      createErrors.documento ? createDocumentoErrorId : undefined
                    }
                    aria-invalid={!!createErrors.documento}
                    className={cn(
                      "h-9 w-full rounded-md border border-input bg-transparent px-3 font-mono text-sm outline-none transition-colors",
                      "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                      "aria-invalid:border-destructive",
                    )}
                  />
                  {createErrors.documento && (
                    <span
                      id={createDocumentoErrorId}
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {createErrors.documento}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={switchToSearch}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    ← Volver a la búsqueda
                  </button>
                  <button
                    type="button"
                    onClick={handleUsarPasajeroClick}
                    className={cn(
                      "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors",
                      "hover:bg-primary/90",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    )}
                  >
                    Usar este pasajero
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
