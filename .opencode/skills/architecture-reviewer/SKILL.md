---
name: architecture-reviewer
description: Review proposed work against the Roti Chani System's documented architecture — domain-module boundaries, the OrderAdapter seam, money rules, and frontend/mobile conventions. Use when a change risks violating the project's architecture or when reviewing the shape of new code.
---

# Architecture Reviewer — Roti Chani System

Check proposed work against the frozen-in-AGENTS.md architecture. Old stubs referencing "Master Blueprint §4" are dead — this project's architecture rules are in `AGENTS.md` and the domain modules.

## The architecture rules (read first — AGENTS.md is the reference)

1. **Domain modules are the source of truth for rules.** `backend/src/domain/` holds business logic:
   - `domain/fulfillment.ts` — order intake + status-transition flows; `createOrder`, `transitionOrderStatus` over an `OrderAdapter` seam.
   - `domain/orderStatus.ts` — the order state machine (`canTransition`/`assertTransition`, throws 409 CONFLICT).
   - `domain/enums.ts` — wire-string ↔ DB-enum mappers + Zod wire-value arrays.
   - `domain/orderMoney.ts` — all money math in integer cents (`toCents`/`fromCents`), fixed 2-decimal strings.
   - `utils/money.ts` — shallow primitives only, no business rules.
2. **Routes are thin HTTP** (`src/modules/*`). Put new rules in `domain/`, not routes.
3. **Adapter seam, no direct `prisma` in domain.** DB logic goes through `db/orderAdapter.ts` (`orderDb`, `ORDER_WITH`). The in-memory fake in `tests/fulfillment.test.ts` proves the seam is real.
4. **Stock rules** — decrement only on `shipped -> delivered`; revert `delivered -> cancelled` restores. `409 INSUFFICIENT_STOCK` on delivery shortfall, no mutation.
5. **Payments** set their own `payment_status`, never mutate `Orders.status`.
6. **Money** = `Decimal(10,2)` → string; integer cents internally.
7. **Status transitions** enforced by `domain/orderStatus.ts` (`pending→processing|pending→cancelled`, etc.).

## Review checklist

- New business logic lands in `domain/`, not a route handler.
- New DB logic lands behind the `OrderAdapter` seam, not as a bare `prisma` call in a domain module.
- No new generated columns; totals computed in `decorateOrder`, not stored.
- Money paths use `toCents`/`fromCents`; no `parseFloat` on prices.
- New schema/table work follows `@map`/`@@map` snake_case + FK delete rules (see database-engineer skill).
- Frontend/mobile changes respect the repo's plainest-practical-deps default (no framework/library adds without a stated reason — see PROPOSAL_mobile_app.md for the mobile precedent).

## Escalation

If a proposal touches something not documented in the source of truth, flag it REQUIRES ADR and route to `spec-guardian` (the compliance gate). You review and advise; spec-guardian is the gatekeeper.