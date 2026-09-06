---
name: mobile-engineer
description: Mobile app work for the Roti Chani System — the Expo (React Native) app in mobile/. Use for mobile screens, API wiring, auth, or Expo config. The stack is expo-router + TanStack Query, not Flutter.
---

# Mobile Engineer — Roti Chani System

Guidance for the `mobile/` Expo app (old stubs referencing Flutter are dead). A separate agent owns mobile implementatation; this skill governs the rules both sides must respect.

## Reference (read first)

- `PROPOSAL_mobile_app.md` — the approved design doc (D1–D18 locked): expo-router navigation, expo-secure-store JWT, TanStack Query, fetch wrapper in `src/api/client.ts`, `EXPO_PUBLIC_API_URL` env config, MYR formatting via one util, theme tokens in `src/theme/tokens.ts`.
- Repo source of truth (`AGENTS.md`, `CONTEXT.md`) for domain vocabulary and API envelope shapes.

## The stack

- Expo ~54, React Native 0.81, expo-router ~6 (file-based), `@tanstack/react-query`, `expo-secure-store`, react-native-safe-area-context, react-native-screens. Currently only `@tanstack/react-query`, `expo-*`, and `vitest` were deliberately added beyond the Expo base (D3/D18).

## Rules

1. API base URL centralised in `src/config/env.ts` via `EXPO_PUBLIC_API_URL` — never hardcode the Tailscale IP in screens/hooks.
2. All requests go through `src/api/client.ts` (envelope `{ data }` / `{ error: { code, message } }`, Bearer token, 401 → logout).
3. Money is a Decimal **string** from the API. Use `src/utils/money.ts` (`formatMoney` → `"10.00 RM"`); never float-multiply prices.
4. Server data caches in TanStack Query keys (`useCustomers`, etc.); mutations invalidate the right keys. RefreshControl + refetchOnFocus keeps lists fresh.
5. Out-of-scope (per proposal §11 unless explicitly re-opened): status transitions, add-payment, live GPS, role-gated UI, HTTPS/cleartext fix.
6. Keep deps lean — no axios, no react-hook-form on mobile; plain controlled state.

## Verification

From `mobile/`: `npm run typecheck`, `npm run lint`, `npm test` (vitest). Android smoke flow is `npm start` + Expo Go (Tailscale on).