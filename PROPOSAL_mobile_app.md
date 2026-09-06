# PROPOSAL — Mobile App (Roti Chani)

> **Status:** Approved. Implementation in progress. Companion review: `REVIEW_mobile_app.md` (reviewer's document).

Companion task spec: `TASK_mobile_app`. This document was ratified through two rounds of grilling; all 18 design decisions (D1–D18) are locked.

---

## 1. Summary

Build a new Expo (React Native) app in a `mobile/` folder alongside the existing `backend/` and `frontend/`. The app talks to the existing local Express API at `http://100.77.24.16:4000` over Tailscale, with the API base URL centralised so the future server swap is a one-line change. No database or backend changes are proposed.

**Phase scope (per the task):** Login, Customers (list + add), Products (list), Orders (list + add), Stock Receipts (list + add). Test via Expo Go on a real Android phone connected to the laptop's Tailnet.

---

## 2. Locked-in design decisions (D1–D18)

These are the forks in the design tree, ratified across two rounds of grilling. All 18 are final.

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | Navigation | **expo-router** (file-based) | Default with `create-expo-app`, structure maps 1:1 to the folder layout. |
| D2 | Token storage | **expo-secure-store** | Encrypted Keychain/Keystore; the right home for a JWT. Tiny dep. |
| D3 | Data fetching | **TanStack Query (`@tanstack/react-query`)** | Already the stack in `frontend/`; gives `refetchOnFocus` so the Products tab stays fresh after a Stock Receipt add, plus standard loading/error/cache state. |
| D4 | HTTP client | Native `fetch` wrapped in one `api/client.ts` | No `axios`. Handles the backend's `{ data }` envelope and `{ error: { code, message } }` shape in one place. |
| D5 | Config centralisation | `EXPO_PUBLIC_API_URL` env override, Tailscale IP as default | One-line swap to the future server. Inlined at build time by Expo; works in Expo Go. |
| D6 | Currency | **MYR**, rendered as `10.00 RM` by a single `formatMoney` util | Malaysian Ringgit. No currency exists in the DB so a single util is the single point of truth. |
| D7 | "Add" flow presentation | Pushed screens via `router.push` | Simpler back/exit, no modal gesture complexity in Expo Go; order screen hosts its own cart line summary. |
| D8 | Order extras | **Out of scope this phase** (no status transition, no add-payment) | Matches task scope. Backend already supports them; trivial follow-up. |
| D9 | GPS link | Plain optional text field for `gpsLink` / `address` | Avoids `expo-location` + permission prompt. Future follow-up. |
| D10 | Roles | Display `user.role` but do not gate UI | Single shop; gating is a cheap later addition. |
| D11 | Forms | Controlled `useState` + minimal in-handler validation | Keeps the dep list lean. No `react-hook-form` / `zod` this phase. |
| D12 | No zod on the client | (rolled into D11) | Backend already validates with zod; client-side only needs length / required / numeric checks. |
| D13 | Theme / styling | `src/theme/tokens.ts` (colors/spacing/radii) + `StyleSheet.create` per screen; light mode only | Mirrors the web palette, zero new deps, one place to retheme. |
| D14 | UI copy language | **English only** this phase | Matches the web exactly. `src/strings.ts` can be introduced later if needed. |
| D15 | Pull-to-refresh | `RefreshControl` on all 4 list screens | Reuses the `refetch()` TanStack already exposes; ~10 lines per screen. |
| D16 | Logout / user identity | In the `(tabs)/_layout` header — current user email/role + logout button (confirm dialog) | One place, always reachable, no extra tab; matches the web sidebar user-box. |
| D17 | Picker UX | A `Picker` component (searchable list-modal) reused by Add Customer, Add Order, Add Stock Receipt | Customers can grow past native Picker comfort; one small component, three callers. |
| D18 | Automated tests | `vitest` with two suites — `money.test.ts` and API error-mapping | Repo already standardises on vitest; cheap insurance on the pure functions (money, error envelope → `ApiError`). |

All eighteen match the task's "simple, focused project; no heavy or unnecessary dependencies" constraint. D3 (TanStack Query) and D18 (vitest) are the only deliberate dependency additions beyond the Expo base; both are dev/runtime knowns already used in `frontend/`.

---

## 3. Folder / file structure

```
Roti_chani_System/
├── backend/        (unchanged)
├── frontend/       (unchanged)
└── mobile/         (NEW — created by `npx create-expo-app mobile -t default`)
    ├── app/                                  # expo-router routes
    │   ├── _layout.tsx                       # root: providers + auth guard
    │   ├── index.tsx                         # redirect to /(auth)/login or /(tabs)
    │   ├── (auth)/
    │   │   ├── _layout.tsx                   # auth-only group layout
    │   │   └── login.tsx                     # Login screen
    │   └── (tabs)/
    │       ├── _layout.tsx                   # bottom tab bar
    │       ├── customers/
    │       │   ├── index.tsx                 # Customers list
    │       │   └── new.tsx                   # Add Customer (pushed)
    │       ├── products/
    │       │   └── index.tsx                 # Products list (no add in scope)
    │       ├── orders/
    │       │   ├── index.tsx                 # Orders list
    │       │   └── new.tsx                   # Add Order (pushed; cart summary inside)
    │       └── stock-receipts/
    │           ├── index.tsx                 # Stock Receipts list
    │           └── new.tsx                   # Add Stock Receipt (pushed)
    ├── src/
    │   ├── api/
    │   │   ├── client.ts                 # fetch wrapper, { data } envelope, Bearer token, 401 handling
    │   │   ├── auth.ts                   # login() / me() typed calls
    │   │   ├── customers.ts              # listCustomers(), createCustomer()
    │   │   ├── products.ts               # listProducts()
    │   │   ├── orders.ts                 # listOrders(), createOrder()
    │   │   └── stockReceipts.ts          # listStockReceipts(), createStockReceipt()
    │   ├── components/
    │   │   ├── Screen.tsx                # SafeAreaView + padding + loading/error slot
    │   │   ├── TextField.tsx             # labelled input
    │   │   ├── Picker.tsx                # searchable list-modal (D17)
    │   │   ├── Button.tsx                # primary / secondary / disabled
    │   │   ├── ConfirmDialog.tsx         # used by the logout confirm (D16)
    │   │   ├── EmptyState.tsx
    │   │   ├── ErrorState.tsx
    │   │   └── ListItem.tsx              # row used by all four list screens
    │   ├── config/
    │   │   └── env.ts                    # exports API_BASE_URL (the one-line swap)
    │   ├── context/
    │   │   └── AuthContext.tsx           # token + user state, login/logout, SecureStore bridge
    │   ├── hooks/
    │   │   ├── useCustomers.ts           # TanStack Query keys + fns
    │   │   ├── useProducts.ts
    │   │   ├── useOrders.ts
    │   │   └── useStockReceipts.ts
    │   ├── theme/
    │   │   └── tokens.ts                 # colors / spacing / radii (D13) — mirrors web palette
    │   ├── types/
    │   │   └── api.ts                    # mirror of frontend/src/api/types.ts
    │   └── utils/
    │       ├── money.ts                  # formatMoney(str) -> "10.00 RM"  (D6)
    │       └── errors.ts                 # ApiError class + user-facing message mapping
    ├── tests/                            # vitest suites (D18)
    │   ├── money.test.ts
    │   └── apiErrorMapping.test.ts
    ├── app.json                          # generated; add `expo-secure-store` plugin if needed
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── .env                              # EXPO_PUBLIC_API_URL=http://100.77.24.16:4000
    └── .env.example
```

Notes on the structure:
- `app/` is expo-router's filesystem routing; `src/` holds the non-route code. The `app/` vs `src/` split keeps route files (UI) separate from logic (api, hooks, utils), which is the same spirit as the repo's `domain/` separation in `backend/`.
- No single mega-file; each resource gets its own `api/<resource>.ts` and `hooks/use<Resource>.ts`.

---

## 4. Dependencies and reasons

`npx create-expo-app mobile -t default` provides the base. Then add only the following:

| Package | Reason |
|---|---|
| `@tanstack/react-query` | D3 — caching, `refetchOnFocus`, mutation invalidation. Already the frontend's stack. |
| `expo-secure-store` | D2 — encrypted JWT storage. |
| `react-native-safe-area-context` | expo-router peer; notch/insets. |
| `react-native-screens` | expo-router peer. |
| `vitest` (dev) | D18 — runs the two pure-function test suites; reuses the repo's existing tooling. |

**Not added (and why):**
- `axios` — `fetch` is enough; one wrapper.
- `react-hook-form` / `zod` — small surface; controlled state is fine.
- `expo-location` — D9; GPS is out of scope.
- `expo-router`'s own `Stack`/`Tabs` are already inside the package — no `react-navigation` install needed (D1).
- No state library (Redux/Zustand) — auth lives in a small `AuthContext`; server data lives in TanStack Query.
- No UI kit (React Native Paper, NativeBase, etc.) — D13: theme tokens + plain `StyleSheet`.

**Verification commands available after install:**
- `npx tsc --noEmit` (typecheck)
- `npx expo lint` (lint)
- `npx expo start` (with Tailscale on phone; or `--tunnel` if needed)
- `npm test` / `npx vitest run` (D18)

---

## 5. Screen list and navigation flow

```
                                ┌──────────────┐
                                │   app/index  │  reads token from SecureStore
                                └──────┬───────┘
                          token absent │ │ token present
                                       ▼ ▼
                          ┌──────────────────────┐
                          │  (auth)/login        │  email + password
                          └──────────┬───────────┘
                                     │ on success → setToken + setUser
                                     ▼
                          ┌──────────────────────┐
                          │  (tabs)/_layout      │  bottom tab bar
                          └──────────┬───────────┘
              ┌──────────┬──────────┼──────────┬─────────────┐
              ▼          ▼          ▼          ▼             ▼
         Customers    Products     Orders   StockReceipts   (Home?)
              │          │          │          │
              │          │          │          │
        ┌─────┴────┐     │    ┌─────┴────┐  ┌──┴───────┐
        │ list     │     │    │ list     │  │ list     │
        │   + new  │     │    │   + new  │  │   + new  │
        └──────────┘     │    └──────────┘  └──────────┘
                         │
                  (read-only, no add)
```

Five root screens + four pushed "add" screens. No "Home" tab in this phase; the four resource tabs are the home.

**Tabs header (D16):** `(tabs)/_layout.tsx` renders a header on every tab showing the logged-in user's `email` and `role` plus a **Logout** button. Tapping Logout opens a `ConfirmDialog`; confirm → `auth.logout()` → `router.replace("/(auth)/login")`.

**Auth guard (`app/_layout.tsx`):**
- On mount, read token from `expo-secure-store`. Show splash until decided.
- Redirect to `(auth)/login` if absent, to `(tabs)/customers` if present.
- 401 from any API call → clear token → redirect to login. (Surfaced via `api/client.ts`.)

**RefreshControl (D15):** all four list screens (Customers, Products, Orders, StockReceipts) wrap their `FlatList` in a `RefreshControl` that calls the TanStack Query `refetch()` of that screen's query — manual pull-to-refresh on top of `refetchOnFocus`.

**Picker reuse (D17):** Add Customer (no Picker needed — single form), Add Order (Picker for customer + Picker for each cart line's product), and Add Stock Receipt (Picker for product) all consume the same `src/components/Picker.tsx` (a searchable list-modal).

---

## 6. Config centralisation (the one-line swap)

`mobile/src/config/env.ts`:

```ts
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://100.77.24.16:4000";
```

`mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://100.77.24.16:4000
```

`mobile/.env.example`:

```
EXPO_PUBLIC_API_URL=http://100.77.24.16:4000
```

Everything in `src/api/*.ts` imports from `config/env.ts`; **no screen or hook hardcodes the URL**. To move to the future server, edit the single line in `.env` (or delete the file and let the default apply) — the only other touch point is the default literal in `env.ts`.

This mirrors the pattern already used in `frontend/src/api/client.ts:1` (`VITE_API_URL ?? "/api"`).

### Network note (worth recording now, not fixing)

Plain `http://` works in Expo Go because Expo Go permits cleartext traffic in dev. A standalone APK build later would need either `usesCleartextTraffic` in `app.json` or an HTTPS reverse proxy on the backend. **Flagged, not fixed this phase.**

---

## 7. API surface used (all already exist; no backend changes)

Verified in `backend/src/`. Every endpoint returns `{ data: ... }`; errors return `{ error: { code, message, details? } }`.

| Mobile call | Endpoint | Notes |
|---|---|---|
| Login | `POST /api/auth/login` | `{ token, user: { id, email, role } }` |
| List customers | `GET /api/customers` | |
| Add customer | `POST /api/customers` | `{ fullName, phone, gpsLink?, address? }` — `phone` is unique. |
| List products | `GET /api/products` | `unitPrice` is a **string** (Decimal serialised). |
| List orders | `GET /api/orders` | Decorated: includes `total/paid/balance` strings and `items[]` with `subtotal`. |
| Add order | `POST /api/orders` | `{ customerId, notes?, items: [{ productId, quantity }] }`, min 1 item. **Stock is NOT decremented on create** (only on `shipped -> delivered`). |
| List stock receipts | `GET /api/stock-receipts` | Includes nested `product`. |
| Add stock receipt | `POST /api/stock-receipts` | `{ productId, quantity, notes? }`. Increments `Products.stockQuantity` server-side in a transaction. |

Status transitions (`PATCH /orders/:id/status`) and payments are **out of scope** this phase (D8).

---

## 8. Backend changes

**None required.** Evidence:

- **CORS**: `backend/src/app.ts:15` — `app.use(cors())` with no origin restriction. CORS only affects browsers; mobile apps don't enforce it, and even if they did, it's already open. *No `cors` config change needed.*
- **Binding**: `backend/src/index.ts:10` — `app.listen(env.PORT, ...)` with no host argument binds `0.0.0.0`, so the backend is reachable on the laptop's Tailscale IP `100.77.24.16:4000`. *No `host` change needed.*
- **Auth**: `POST /api/auth/login` already returns `{ token, user }`; `requireAuth` (backend/src/middleware/auth.ts:27) already validates `Authorization: Bearer <token>`. *No auth change needed.*
- **Routes**: every endpoint above already exists. *No route changes.*
- **Schema**: the mobile scope uses no field the schema doesn't already expose. *No Prisma migration needed.*

If a future change is identified (e.g., a server-side feature for the "Home" tab), it will be filed as a separate item before any edit, per the task's constraints.

---

## 9. Money handling

`backend/src/utils/money.ts` already operates in integer cents to avoid float drift, and the API serialises decimals as **strings** (`"10.00"`). The mobile side mirrors the same idea — never do float math on prices. A single util:

```ts
// mobile/src/utils/money.ts (sketch)
const CURRENCY = "RM";
export function formatMoney(decimalString: string): string {
  return `${decimalString} ${CURRENCY}`;            // "10.00 RM"
}
export function toNumber(decimalString: string): number {
  return Number(decimalString);
}
```

For inputs (Add Order quantity × product unit price for the cart line preview), parse the string into cents, multiply, format back. No floats. Future-proof for when the wire format stays a Decimal string and the backend owns the math.

---

## 10. Verification plan (run after implementation, before declaring "done")

From `mobile/`:

1. `npx tsc --noEmit` — typecheck passes.
2. `npx expo lint` — lint passes.
3. `npm test` (vitest) — `money.test.ts` and `apiErrorMapping.test.ts` pass.
4. `npx expo start` — dev server up. Open Expo Go on the Android phone (Tailscale on).
5. Manual smoke test on phone, with backend running on laptop:
   - Login with `admin@roti.local` / `Admin123!` (from `backend/prisma/seed.ts`).
   - Header shows email + role; Logout opens the confirm dialog and signs out cleanly.
   - Customers tab → list loads → pull-to-refresh (RefreshControl, D15) → Add Customer → new customer appears.
   - Products tab → list loads, prices show `10.00 RM`.
   - Orders tab → list loads, statuses render → Add Order (Picker for customer, cart with Picker for product) → new order appears.
   - Stock Receipts tab → list loads → Add Stock Receipt (Picker for product) → receipt appears; switch to Products tab, confirm the product's `stockQuantity` incremented (TanStack Query refetchOnFocus, D3).
6. From the phone, kill backend → any tab → error state renders gracefully; restart backend → refresh succeeds.
7. Clear app / force-quit → relaunch → still logged in (SecureStore persistence).

---

## 11. Out of scope (this phase)

- Status transitions and payments on orders (D8).
- Live GPS capture for `gpsLink` (D9).
- Role-based UI gating (D10).
- Reports tab.
- HTTPS / `usesCleartextTraffic` (flagged, not fixed).
- Push notifications, offline cache, pagination.
- E2E tests (Detox/Maestro). Manual smoke only this phase.
- The remote Ubuntu server (`100.127.44.62`) — explicit per task.

---

## 12. Implementation plan (post-approval, for reference)

If approved, the build proceeds in this order — each step leaves the app in a runnable state:

1. **Scaffold**: `npx create-expo-app mobile -t default` (TS + expo-router pre-wired).
2. **Install deps**: add the five packages from §4.
3. **Config + types + utils + theme**: `src/config/env.ts`, `src/types/api.ts`, `src/utils/{money,errors}.ts`, `src/theme/tokens.ts`.
4. **API client + auth context**: `src/api/client.ts` (with 401 handling), `src/api/auth.ts`, `src/context/AuthContext.tsx`.
5. **Root layout + auth guard + login screen**: `app/_layout.tsx`, `app/(auth)/login.tsx`.
6. **Tabs layout + Customers + Add Customer**: `app/(tabs)/_layout.tsx` (header with email/role/Logout + ConfirmDialog), `customers/index.tsx`, `customers/new.tsx`, `src/api/customers.ts`, `src/hooks/useCustomers.ts`. Picker + RefreshControl + theme tokens all wired here.
7. **Products tab** (read-only, with RefreshControl).
8. **Orders + Add Order** (cart line summary using Picker, inside the pushed screen).
9. **Stock Receipts + Add Stock Receipt** (Picker for product).
10. **Tests** (D18): `tests/money.test.ts`, `tests/apiErrorMapping.test.ts`, run `npx vitest run`, both green.
11. **Verification pass** (§10).
12. Hand-off: short note in `mobile/README.md` on how to swap `EXPO_PUBLIC_API_URL` to the future server.

---

## 13. Reviewer checklist (for `REVIEW_mobile_app.md`)

When you write the review, please confirm or push back on:

- [ ] D1–D18 in §2 are acceptable.
- [ ] Folder structure in §3 is acceptable.
- [ ] Dependency list in §4 is acceptable (including `vitest` for D18).
- [ ] Navigation flow + header logout + RefreshControl in §5 are acceptable.
- [ ] Config centralisation in §6 is acceptable.
- [ ] "No backend changes" in §8 is acceptable (CORS already open; binding already `0.0.0.0`).
- [ ] Money format `10.00 RM` in §9 is acceptable.
- [ ] Verification plan in §10 is acceptable.
- [ ] Out-of-scope list in §11 is correct.

Explicit approval is required before step 1 of §12 begins.
