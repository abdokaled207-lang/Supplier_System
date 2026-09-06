# AGENTS.md

Roti Chani System — a full-stack order/stock/payment app. Two workspaces: `backend/` (Express + TS + Prisma) and `frontend/` (React + Vite + TanStack Query). MySQL 8 via Docker (`docker-compose.yml`) or the local MySQL80 Windows service.

## Source of truth

- **Live schema = Prisma migrations** at `backend/prisma/migrations/` (models in `backend/prisma/schema.prisma`). Never edit an applied migration; create a new one via `npm run db:dev`.
- `Roti_chani_system_v3.sql` is **reference only** and now diverges from the app schema. Do not treat it as current.
- Seed data (products + admin user) lives in `backend/prisma/seed.ts`.

## Commands

Run from the relevant workspace dir (they are not npm workspaces — `cd` each):

```powershell
# backend
npm install
npm run db:migrate    # apply migrations
npm run db:seed       # 4 products + admin (admin@roti.local / Admin123!)
npm run dev           # :4000
npm run typecheck && npm run lint && npm test   # verify before any change lands

# frontend
npm install
npm run dev           # :5173 (proxies /api -> :4000)
npm run typecheck && npm run lint && npm run build && npm test   # verify before any change lands (vitest + jsdom)
```

Prisma's postinstall is gated behind an `allow-scripts` policy on this machine: after `npm install`, run `npm approve-scripts @prisma/client prisma @prisma/engines esbuild` (and `esbuild` in frontend) or `prisma generate` will not work.

## Environment

- Backend reads env from `backend/.env` (via `src/config/env.ts`). Root `.env.example` is the template; note `DATABASE_URL` differs for Docker vs local MySQL80.
- `src/config/env.ts` validates with Zod and **throws at import time** if `DATABASE_URL`/`JWT_SECRET` are missing. Vitest injects them via `vitest.config.ts`, so tests don't need a DB for the app-routing suite.
- `JWT_EXPIRES_IN` is a string — cast to `jwt.SignOptions["expiresIn"]` where used.

## Architecture — domain modules are the source of truth for the rules

Business logic lives in `backend/src/domain/` (deep modules, small interfaces); route files in `src/modules/*` are thin HTTP. **Put new rules here, not in the routes.**

- `domain/fulfillment.ts` — the order-intake and status-transition **flows**. Small interface (`createOrder`, `transitionOrderStatus`) but a deep implementation: price snapshot, stock-on-delivery, legality checks. **Accepts its DB dependency** (don't create it) via a small `OrderAdapter` seam.
- `db/orderAdapter.ts` — the **Prisma-backed adapter** at that seam (`orderDb`), plus the shared `ORDER_WITH` include. Two adapters exist (this + the in-memory fake in `tests/fulfillment.test.ts`), so the seam is real. **Add DB logic through the adapter, never by calling `prisma` inside a domain module.**
- `domain/orderStatus.ts` — the order state machine (`canTransition`, `assertTransition` throws `409 CONFLICT`).
- `domain/enums.ts` — the shared wire-string ↔ DB-enum mappers (`toOrderStatus`, `toPaymentType`) + wire value arrays for Zod (`WIRE_ORDER_STATUSES`, `WIRE_PAYMENT_TYPES`). Replaces per-route `STATUS_MAP`/`TYPE_MAP`.
- `domain/orderMoney.ts` — **all money math** (`orderTotals`, `paymentStatusFor`, `decorateOrder`). Computes in **integer cents** (`toCents`/`fromCents` in `utils/money.ts`) to avoid float drift; returns fixed 2-decimal strings.
- `utils/money.ts` — shallow primitives only (`toCents`, `fromCents`, `moneyToString`, `Money`). No business rules.

## Business rules (the tricky parts)

- **Stock decrements only on `shipped -> delivered`.** `pending`/`processing`/`shipped` consume nothing. Reverting `delivered -> cancelled` restores stock. All inside `domain/fulfillment.ts` `transitionOrderStatus`, behind the `OrderAdapter` seam.
- **Insufficient stock on delivery** returns `409 INSUFFICIENT_STOCK` with per-item details, no DB mutation.
- Order status transitions are enforced by `domain/orderStatus.ts`: `pending->processing|pending->cancelled`, `processing->shipped|processing->cancelled`, `shipped->delivered|shipped->cancelled`, `delivered->cancelled`.
- `Order_Items.subtotal` existed in the legacy dump as a STORED generated column, but the app **computes subtotal/total/paid/balance in `decorateOrder`** (`domain/orderMoney.ts`). Do not add a generated column; Prisma schema omits it.
- Payments set their own `payment_status` (`unpaid`/`partial`/`paid`) from how much of the order is covered — they never mutate `Orders.status`.
- Money is `Decimal(10,2)`; serialize as string (see `utils/money.ts`).

## UI & frontend

- **Web Interface Guidelines (Vercel)** are the adopted UI standard for the web app — accessibility, focus states, forms, animation, typography, performance, navigation, touch, dark mode. Review UI work against them (`review-ui` command); skipping them is a deviation, not a preference.
- Frontend design system: plain CSS with custom-property tokens in `src/styles.css`; shared components in `src/components/` (LoadingSkeleton, ErrorBoundary, EmptyState, ConfirmDialog, SearchInput, InlineError).
- Client-side money aggregation (Dashboard) is **display-only** — the backend integer-cents rule remains the authority on anything computed or compared. See CONTEXT.md "Dashboard metrics".

## Tests

- Unit tests in `tests/*.test.ts` run **without a DB** (the domain modules are pure): `tests/orderMoney.test.ts`, `tests/orderStatus.test.ts`, `tests/fulfillment.test.ts` (drives the stock rules through `OrderAdapter` with an in-memory fake), `tests/app.test.ts`.
- `tests/integration/orders.stock.test.ts` needs a live DB — run it separately via `npm run test:integration`. Default `npm test` excludes `tests/integration/`.

## FK delete behavior (unchanged from legacy, drives integrity)

- `Customers -> Orders`: `RESTRICT` (can't delete a customer with orders).
- `Orders -> Order_Items`, `Orders -> Payments`: `CASCADE`.
- `Products -> Order_Items`, `Products -> Stock_Receipts`: `RESTRICT`.

## Gotchas

- On this machine **Docker is not installed** and starting the MySQL80 service needs admin elevation. `prisma migrate`/`seed` will fail until a DB is reachable — this is an environment limitation, not a code issue.
- New tables in Prisma use `@map`/`@@map` to keep the original snake_case table/column names (`Customers`, `Order_Items`, etc.). Enum values use `@map`, enum types use `@@map`.
