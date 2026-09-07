---
name: database-engineer
description: Database and data-layer work for the Roti Chani System — Prisma schema/migrations, MySQL 8, the OrderAdapter seam. Use for schema changes, migrations, queries, or data integrity issues. This is MySQL, not PostgreSQL.
---

# Database Engineer — Roti Chani System

Data-layer guidance for the actual stack (the PostgreSQL/pgvector references in old stubs are dead — this project is **MySQL 8 + Prisma**).

## Source of truth (read first)

- **Live schema = Prisma migrations** at `backend/prisma/migrations/`, models in `backend/prisma/schema.prisma`. Never edit an applied migration — create a new one via `npm run db:dev` (AGENTS.md §Source of truth).
- `docs/legacy/v3.sql` is the original schema dump (reference only) and **diverges** from the app schema. Do not treat it as current.
- Seed (4 products + admin user) lives in `backend/prisma/seed.ts`.

## Schema conventions

- Tables/columns keep original snake_case via `@map`/`@@map`: `Customers`, `Order_Items`, `Payments`, `Stock_Receipts`, `Products`; enums use `@map` for values and `@@map` for the enum type (`order_status`, `payment_status`, `payment_type`, `user_role`).
- **No generated columns.** `Order_Items.subtotal` existed as a stored generated column in the legacy dump; the app computes subtotal/total/paid/balance in `decorateOrder` (`domain/orderMoney.ts`). Do not add it to the schema.
- Money is `Decimal(10,2)`; serialize as string.
- FK delete behavior (drives integrity, unchanged from legacy):
  - `Customers -> Orders`: `RESTRICT`
  - `Orders -> Order_Items`, `Orders -> Payments`: `CASCADE`
  - `Products -> Order_Items`, `Products -> Stock_Receipts`: `RESTRICT`

## Where DB logic lives

- **Domain modules never call `prisma` directly.** They take a DB dependency through the `OrderAdapter` seam (`backend/src/db/orderAdapter.ts`, shared `ORDER_WITH` include; the in-memory fake in `tests/fulfillment.test.ts` is the second adapter). Add DB logic through the adapter.
- Route files (`src/modules/*`) call `prisma` for simple CRUD but must not contain business rules — those live in `domain/`.

## Checks before shipping a change

1. Migration added, not edited; `npm run db:migrate` applied cleanly.
2. Enum value changes use `@map` (DB value stays a wire string) — see `domain/enums.ts` for the wire↔DB mappers.
3. Money always traverses `toCents`/`fromCents`; no float math in queries or mapping.
4. New relations respect the FK delete behavior above.
5. New tables keep snake_case via `@map`/`@@map`.
6. Remember: on this machine migrations need a reachable MySQL (Docker not installed; MySQL80 needs admin elevation) — a failure there is environmental, not a schema bug.