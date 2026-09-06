---
name: api-contract-engineer
description: API contract work for the Roti Chani System — the Express API both web and mobile clients consume. Use when adding or changing an endpoint, updating the shared TypeScript types, or reviewing request/response shapes. Source of truth: the actual route/domain code, not an external spec.
---

# API Contract Engineer — Roti Chani System

Contract rules for the Express API (`backend/src/`). The old "six Tech Spec §2 endpoints" stub refs are dead — the real surface is in `src/modules/*`.

## The contract shape (read first)

- **Success**: every JSON body is wrapped `{ data: ... }`. `POST`s return `201`. `DELETE`s may return `204` (no body) — the frontend client treats 204 as `undefined data`.
- **Errors**: `{ error: { code, message, details? } }`, produced by `middleware/error.ts`:
  - `400 VALIDATION_ERROR` (Zod body/params fail; `details` = `error.flatten()`)
  - `401 UNAUTHORIZED` (missing/expired JWT — `middleware/auth.ts`)
  - `404 NOT_FOUND`
  - `409 CONFLICT` (including Prisma P2002 unique violation)
  - `409 INSUFFICIENT_STOCK` (delivery-time stock shortfall, per-item `details`) — `domain/fulfillment.ts`
  - `500 INTERNAL_ERROR`
- **Auth**: `GET /api/health` and `POST /api/auth/login` are public. Everything else requires `Authorization: Bearer <token>`.
- **Money**: `Decimal(10,2)` serialized as a **fixed 2-decimal string** (`"10.00"`), not a number — `utils/money.ts`. Order items carry price snapshot + `subtotal`; order carries `total`/`paid`/`balance` (computed in `decorateOrder`, `domain/orderMoney.ts`).
- **Status/type wire values** are the lowercase strings, shared via `domain/enums.ts`: `WIRE_ORDER_STATUSES` = `pending|processing|shipped|delivered|cancelled`; `WIRE_PAYMENT_TYPES` = `cash|bank_transfer|card|online`. Zod uses these arrays; DB enums map via `toOrderStatus`/`toPaymentType`.

## Endpoints (exact — keep sync with README §API)

- `GET /api/health` → `{ status: "ok", db: "connected" }` or `503` if DB unreachable (public)
- `POST /api/auth/login` → `{ data: { token, user: { id, email, role } } }`
- `GET/POST /api/customers`, `GET/PUT/DELETE /api/customers/:id` — list `GET` supports `?page=&pageSize=` → `{ data, total, page, pageSize }`
- `GET/POST /api/products`, `GET/PUT/DELETE /api/products/:id` — list `GET` supports `?page=&pageSize=`
- `GET/POST /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status` — list `GET` supports `?page=&pageSize=`
- `POST/GET/DELETE /api/payments`
- `GET/POST/DELETE /api/stock-receipts` — list `GET` supports `?page=&pageSize=`
- `GET /api/reports/orders-by-status`, `GET /api/reports/customer-balance`, `GET /api/reports/product-stock`
- `GET /api/reports/customer-balance.csv`, `GET /api/reports/product-stock.csv`, `GET /api/reports/orders-by-status.csv` — RFC 4180 + UTF-8 BOM, auth required

## Rules for contract changes

1. Update BOTH consumers: `frontend/src/api/types.ts` and the mobile mirror (`mobile/src/types/api.ts`) in the same change.
2. New response fields: extend the shared TypeScript interface, don't loosen to `any`.
3. New endpoints: validate with Zod, wrap in `{ data }`, mount behind `requireAuth`, add to README §API.
4. Ids arrive as strings in route params → `z.coerce.number()` (params schema), never `Number()` on unvalidated input.
5. If the contract itself is ambiguous or a design decision is required (e.g., pagination, filter params, dashboard aggregates), flag REQUIRES ADR — do not invent a shape silently.