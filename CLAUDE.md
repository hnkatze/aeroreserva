# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

<!-- @hnkatze/claude-rules:start -->
<!-- managed block — do not edit manually; use `claude-rules` CLI -->
@.claude/rules/accessibility.md
@.claude/rules/build-verification.md
@.claude/rules/error-handling.md
@.claude/rules/git.md
@.claude/rules/nextjs-structure.md
@.claude/rules/tailwind.md
@.claude/rules/typescript.md
<!-- @hnkatze/claude-rules:end -->

## Critical: read the bundled docs first

This repo runs **Next.js 16.2.9** (see `AGENTS.md`). It has breaking changes from older Next.js
versions, so training-data assumptions are unreliable. The matching docs ship inside the install
at `node_modules/next/dist/docs/` (`01-app/`, `02-pages/`, `03-architecture/`). Read the relevant
guide there BEFORE writing or changing app code, and honor any deprecation notices.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build — run this to verify code compiles before committing
npm run start    # Serve the production build
npm run lint     # ESLint 9 flat config (core-web-vitals + typescript rules)
```

- No test runner is configured yet. Do not assume Jest/Vitest/Playwright exist — none are installed.
- `build-verification.md` mandates a compile check before committing. For this stack that means
  `npm run build` (the rule's `ng build` example is Angular — translate it to Next.js).

## Stack & architecture

- **Next.js 16 App Router** — all source lives under `src/`. Routes are in `src/app/`
  (`src/app/layout.tsx` root layout, `src/app/page.tsx` home). Server Components are the default;
  add `'use client'` only when a component needs hooks or browser APIs.
- **React 19.2** + **TypeScript 5** in `strict` mode.
- **Data layer**: PostgreSQL 17 in a local Docker container (`postgres-dev`, port 5432, database
  `aeroreserva`), accessed with **`pg` (node-postgres) — no ORM** (deliberate: the project must
  demonstrate explicit `SELECT ... FOR UPDATE`, isolation levels, and deadlocks). The connection
  pool and the `query()` / `withTransaction()` helpers live in `src/lib/db.ts`. Connection string
  comes from `DATABASE_URL` in `.env.local` (gitignored; see `.env.example`). Health check:
  `GET /api/health`. API endpoints that touch the DB must set `export const dynamic = 'force-dynamic'`.
- **Tailwind CSS v4** — CSS-first config. There is no `tailwind.config.*`; theme tokens are defined
  in `app/globals.css` via `@import "tailwindcss"` and the `@theme inline {}` block. Fonts (Geist /
  Geist Mono) are wired as CSS variables in the root layout and exposed as `--font-sans` /
  `--font-mono`. PostCSS uses `@tailwindcss/postcss` (`postcss.config.mjs`).
- **Path alias**: `@/*` maps to `./src/*` (`tsconfig.json`), so import as `@/lib/db`,
  `@/components/ui/button`, etc. — not long relative paths.
- **Dark mode** is **class-based** (`@custom-variant dark (&:is(.dark *))` with `:root`/`.dark` in
  `globals.css`), NOT `prefers-color-scheme`. There is no `.dark` toggle yet, so the app currently
  renders in light mode. Use theme tokens (`bg-card`, `text-foreground`) with `dark:` variants; never
  hardcode dark-only colors that assume a dark background.

## Rules caveat — some examples are Angular, not React

Several imported rule files (`error-handling.md`, `accessibility.md`, parts of
`build-verification.md`) use Angular syntax (`@Injectable`, `HttpClient`, `signal()`, `(click)=`,
`ng build`). This is a **React/Next.js** project — apply the underlying principle (discriminated-union
async state, semantic HTML, label/input association, compile-before-commit) and express it in
React/Next idioms, not Angular APIs. `typescript.md`, `git.md`, `tailwind.md`, and
`nextjs-structure.md` are framework-correct and apply directly.

## Conventions worth keeping consistent

- Follow `nextjs-structure.md` for folder layout (route groups, `loading.tsx`/`error.tsx`,
  colocation, feature-based organization for larger areas).
- Commits: Conventional Commits, English, no AI attribution / `Co-Authored-By` (see `git.md`).
- TypeScript: no `any` (use `unknown`), `interface` for object shapes, string unions over `enum`,
  `import type` for type-only imports (see `typescript.md`).
