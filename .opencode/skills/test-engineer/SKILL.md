---
name: test-engineer
description: Plan and review tests in the Roti Chani System — vitest unit tests (domain modules, no DB), route-level tests over mocked Prisma, and live integration tests. Use when writing or reviewing test files in backend/ or frontend/.
---

# Test Engineer — Roti Chani System

Guide test strategy against the repo's documented testing setup (AGENTS.md §Tests).

## The test topology (read this first)

- **Backend unit tests** (`backend/tests/*.test.ts`) run **without a DB** — the domain modules are pure. Existing: `orderMoney`, `orderStatus`, `fulfillment` (drives stock rules through an in-memory `OrderAdapter` fake), `app` (supertest routing without touching `prisma`).
- **Backend integration** (`backend/tests/integration/orders.stock.test.ts`) needs a live DB — run via `npm run test:integration`, excluded from default `npm test`.
- **Frontend** has vitest in `frontend/package.json` (`test: vitest run`) — currently a thin scaffold; `api/client.ts` and money utils are the testable seams.
- `backend/vitest.config.ts` injects `DATABASE_URL`/`JWT_SECRET` so app-routing tests run DB-free.

## Rules for new tests

1. **Domain rules go in domain tests.** Money math, status transitions, stock decrement-on-delivery belong in `tests/orderMoney|orderStatus|fulfillment.test.ts` style — no DB, pure functions, integer cents.
2. **Route tests mock the Prisma client** with `vi.mock("../src/db/prisma")` so `npm test` stays green on a machine without MySQL. Do NOT rely on a live DB for success paths in `tests/*.test.ts`. Only genuinely transactional/integration behavior goes under `tests/integration/`.
3. **Envelope shape**: every API response is `{ data: ... }`; errors are `{ error: { code, message, details? } }`. Assert both.
4. **Money assertions**: compare 2-decimal strings (`"10.00"`), never floats from string→Number round-trips.
5. **Follow the seam**: new DB logic is tested through the `OrderAdapter` seam (`db/orderAdapter.ts`), with the in-memory fake from `tests/fulfillment.test.ts` as the pattern — never call `prisma` directly in a domain test.
6. Run `npm run typecheck && npm run lint && npm test` in the workspace before a change lands.

## What to look for in a review

- Tests assert behavior, not implementation — prefer observable response bodies over mock-call-counts where possible.
- Success + failure paths: validation errors (400 VALIDATION_ERROR), auth guards (401 UNAUTHORIZED), 409 CONFLICT transitions, `409 INSUFFICIENT_STOCK`.
- Fixtures for mocked Prisma calls: Prisma's generated return types are strict (Decimal, enums, `createdAt: Date`), so mock payloads typically need a narrow `as never` cast at the `mockResolvedValue` call site. Prefer a single cast on the mocked call over `as`-casting the whole fixture, and prefer `expect(...).toMatchObject(...)` over deep `toEqual` when JWT/Date fields add keys.
- New tests actually run: they were executed, not just written.