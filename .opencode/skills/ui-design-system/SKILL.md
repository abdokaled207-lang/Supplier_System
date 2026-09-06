---
name: ui-design-system
description: Frontend design-system and UI-compliance work for the Roti Chani System web app (frontend/). Use for styling, reusable components, accessibility, and Web Interface Guidelines compliance. Zero-dep vanilla CSS theme.
---

# UI Design System — Roti Chani System (web)

Design rules for `frontend/`. The stack is React 18 + Vite + TanStack Query with **plain vanilla CSS** (no Tailwind/UI kit — a deliberate repo default). The mobile app mirrors the palette via `mobile/src/theme/tokens.ts`.

## Conventions

- Single global stylesheet `src/styles.css` today; CSS custom properties are the theming mechanism. Keep new tokens as variables (colors, spacing, radii, breakpoints).
- Reusable components live in `src/components/` (LoadingSkeleton, ErrorBoundary, EmptyState, ConfirmDialog, SearchInput, …); pages in `src/pages/`.
- Tabular numbers for money columns; money renders as fixed 2-decimal strings (e.g. `"10.00"`), never floats.
- **Client-side money aggregation (Dashboard) is display-only.** Summing Decimal strings with `Number()` for display charts/stats is acceptable because the backend remains the integer-cents authority and nothing client-computed is written back. Format aggregates with `Intl.NumberFormat`. Do not compute money that is persisted or compared for correctness on the client.
- Semantic HTML: `<button>` for actions, `<a>`/`<Link>` for navigation, `<label>` for inputs, `<table>` for tabular lists.
- Layout favoured over JS measurement (flex/grid; no `getBoundingClientRect`).

## Web Interface Guidelines compliance (run before shipping UI)

Fetched fresh at review time — invoke the `review-ui` command or apply the core rules:

- **Accessibility**: icon buttons need `aria-label`; form controls need `<label>`/`aria-label`; interactive elements need keyboard support; decorative icons `aria-hidden="true"`; async updates use `aria-live="polite"`; `h1`–`h6` hierarchy with a skip link.
- **Focus**: visible `:focus-visible` ring; never `outline: none` without a replacement.
- **Forms**: meaningful `name` + `autocomplete`; correct `input[type]`; loading spinner on submit; inline validation error next to the field; placeholder ends with `…`.
- **Animation**: honor `prefers-reduced-motion`; animate only `transform`/`opacity`; never `transition: all`.
- **Typography**: `…` not `...`; loading states end with `…`; curly quotes; `font-variant-numeric: tabular-nums` for number columns; `text-wrap: balance` on headings.
- **Content**: empty states handled; long text truncated (`truncate`/`line-clamp`); flex children `min-w-0`.
- **Nav & state**: URL reflects state (filters in query params); destructive actions use a confirm dialog — never immediate delete; links are real `<a>`/`<Link>` (Cmd/Ctrl+click works).
- **Touch**: `touch-action: manipulation`; `overscroll-behavior: contain` on modals.
- **Anti-patterns to flag**: `transition: all`, `outline: none` w/o focus replacement, `user-scalable=no`, `onPaste` preventDefault, `<div onClick>`, images without dimensions, hardcoded date/number formats (use `Intl.*`), gesture-only actions.

## Verification

`npm run typecheck && npm run lint && npm run build` from `frontend/`, then the `review-ui` compliance gate.