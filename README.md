# Roti Chani System

An order/stock/payment management system for a small roti business. The original business schema is preserved at `docs/legacy/v3.sql` (reference only); the live schema is maintained as Prisma migrations in `backend/prisma/`.

## Stack

- **Backend:** Node + Express + TypeScript + Prisma + Zod, JWT auth (backend/)
- **Frontend:** React 18 + Vite + TanStack Query (frontend/)
- **Database:** MySQL 8 (Docker `docker-compose.yml`, or the local MySQL80 service)

## Quick start

0. **Choose a database connection.** Copy `.env.example` to `.env` at the repo root and set `DATABASE_URL`. Two options:

   - Docker: `docker compose up -d db` (creates `roti_chani_system`, user `app`).
   - Local MySQL80 Windows service: set `DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/roti_chani_system"` and start the service.

1. **Backend**
   ```powershell
   cd backend
   npm install
   Copy-Item ..\.env.example .env   # already exists with dev defaults; edit them
   npm run db:migrate               # applies migrations in backend/prisma/migrations
   npm run db:seed                  # 4 products + admin user
   npm run dev                      # http://localhost:4000
   ```

2. **Frontend** (in a second terminal)
   ```powershell
   cd frontend
   npm install
   npm run dev                      # http://localhost:5173
   ```

Login with the seeded admin: `admin@roti.local` / `Admin123!`.

## Commands

| Task | Command (from `backend/` or `frontend/`) |
| --- | --- |
| Dev servers | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Backend tests | `npm test` (from `backend/`) |
| Frontend tests | `npm test` (from `frontend/`) |
| Apply migrations | `npm run db:migrate` |
| Create a migration | `npm run db:dev` |
| Seed | `npm run db:seed` |

## Stock rules

- Receiving stock (`POST /api/stock-receipts`) increments `Products.stock_quantity`.
- **Stock only decrements when an order reaches `delivered`** (transition `shipped -> delivered`). Reverting a delivered order to `cancelled` restores stock. Orders in `pending`/`processing`/`shipped` do **not** consume stock.
- Insufficient stock on delivery returns `409 INSUFFICIENT_STOCK` with per-item details.

## Security

**Passwords** — admin passwords are hashed with bcrypt (12 rounds). Never set a plain-text password in the database.

**Login rate limiting** — the login endpoint allows 5 attempts per 15-minute window per IP. After the limit is exceeded, further attempts return `429 TOO_MANY_REQUESTS` for 15 minutes.

**API auth** — every `/api/*` route except `/api/health` and `/api/auth/login` requires a valid JWT Bearer token. Tokens expire after `JWT_EXPIRES_IN` (default: 7 days).

**HTTPS required** — this system handles login credentials and financial data. It **must be deployed over HTTPS**. Enable TLS in the hosting platform (e.g. Vercel, Railway, Render) or configure a reverse proxy (nginx with `ssl_certificate`). Do not deploy over plain HTTP.

**Backups** — the MySQL database contains all financial data (orders, payments, balances). A backup strategy is **required** before going live:

> **Manual backup procedure** (automate with a cron job or CI pipeline for production):
> ```bash
> # Dump the database
> mysqldump -h <host> -P 3306 -u app -p roti_chani_system > roti_backup_$(date +%Y%m%d_%H%M%S).sql
> # Or with Docker:
> docker compose exec db mysqldump -u root -p roti_chani_system > roti_backup_$(date +%Y%m%d_%H%M%S).sql
> ```
> Store the `.sql` file in cloud storage (Google Drive, AWS S3, Backblaze B2, etc.) — not on the same server as the database.
> Restore with: `mysql -h <host> -u app -p roti_chani_system < roti_backup_YYYYMMDD_HHMMSS.sql`

**Secrets** — all secrets (`DATABASE_URL`, `JWT_SECRET`, etc.) live in environment variables (`.env`). The `.env` file is gitignored. Never commit secrets to the repository.

## API

All routes except `GET /api/health` and `POST /api/auth/login` require `Authorization: Bearer <token>`.

- `GET /api/health` — public health check with DB status (503 if DB unreachable)
- `GET/POST/PUT/DELETE /api/customers` — list supports `?page=&pageSize=`
- `GET/POST/PUT/DELETE /api/products` — list supports `?page=&pageSize=`
- `GET/POST /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status`, **`PUT /api/orders/:id`** (full edit) — list supports `?page=&pageSize=`
- `POST/GET/DELETE /api/payments`
- `GET/POST/DELETE /api/stock-receipts` — list supports `?page=&pageSize=`
- `GET /api/reports/orders-by-status`, `GET /api/reports/customer-balance`, `GET /api/reports/product-stock`
- `GET /api/reports/customer-balance.csv`, `GET /api/reports/product-stock.csv`, `GET /api/reports/orders-by-status.csv` — RFC 4180 CSV with UTF-8 BOM

### Order edit (`PUT /api/orders/:id`)

Replaces the order's customer, line items, order date, expected delivery date, and notes. Same wire shape as `POST /api/orders` with two extras:

- `expectedDeliveryAt`: ISO 8601 timestamp or `null` (clears the date)
- `acknowledgeUnderTotal`: `true` to save even when the new total is below what has been paid

Stock rules on edit: only the `delivered` status holds stock, so only edits to a delivered order adjust stock quantities (net delta). Pending / processing / shipped / cancelled orders never touch stock.

If the new total is below the already-paid amount and `acknowledgeUnderTotal` is not set, the server returns `409 PAID_EXCEEDS_TOTAL` with `details: { newTotal, paid }`. The frontend should show a confirmation dialog and resubmit with `acknowledgeUnderTotal: true` if the admin accepts the underflow.

Order wire format includes `expectedDeliveryAt` (nullable) and `statusUpdatedAt` (auto-updated on every status change via `PATCH /api/orders/:id/status`).

Paginated list responses: `{ "data": [...], "total": N, "page": N, "pageSize": N }`

Errors: `{ "error": { "code", "message", "details?" } }`.
