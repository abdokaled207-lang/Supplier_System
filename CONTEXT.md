# CONTEXT.md — Roti Chani domain model

Shared vocabulary for this project. Use these terms in code and discussion.

## Core entities

- **Customer** — a buyer. Uniquely identified by phone. Has an optional GPS link, address, and delivery **area** (free-text region, see below).
- **Product** — one of the four roti items. Has a `unit_price` (money) and a `stock_quantity`.
- **Order** — a customer's request for a quantity of products. Has a lifecycle (`pending → processing → shipped → delivered`, or `cancelled`).
- **Order Item** — one product line inside an order (product + quantity + price snapshot). Not a standalone entity.
- **Payment** — a payment against an order. Has an amount, type, and its own status (`unpaid`/`partial`/`paid`).
- **Stock Receipt** — stock received from supplier/company; increments a product's stock.
- **User** — system login (admin/employee). Not part of the customer-facing domain.

## Key rules & concepts

- **Money** — always `Decimal(10,2)`, handled as integer cents internally, serialized as 2-decimal strings.
- **Fulfillment** — the act of moving an order to `delivered`; the only step that consumes stock. Reverting to `cancelled` restores it.
- **Delivery area** — a customer's free-text region (`Customer.area`, nullable). The web form suggests real Melaka/Johor names from the static list in `frontend/src/data/deliveryAreas.ts`, but accepts any text; the backend treats it as an optional string only.
- **Price snapshot** — an Order Item stores the product's price at order time, so later price changes don't rewrite history.
- **Stock** — a product's available quantity. Incremented by receipts, decremented on fulfillment.
- **OrderAdapter** — the seam between the fulfillment module and the database. Two implementations: the Prisma-backed adapter and the in-memory fake used by tests.

## Dashboard metrics (web frontend `Dashboard.tsx`)

Client-side aggregation of existing endpoints (no backend endpoint). Definitions are deliberate and display-only:

- **Low stock** — a product at or below `LOW_STOCK_THRESHOLD = 5` units is "low stock".
- **Revenue (non-cancelled)** — all-time sum of `order.total` for orders whose status is not `cancelled`.
- **Outstanding balance** — sum of `balance` across the customer-balance report.
- **Open orders** — orders whose status is `pending`, `processing`, or `shipped`.
- Money is summed client-side from Decimal strings and formatted with `Intl.NumberFormat`; the backend integer-cents rule remains the authority — client aggregation is display-only, never written back.
