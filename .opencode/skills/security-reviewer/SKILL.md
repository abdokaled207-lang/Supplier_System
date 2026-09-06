---
name: security-reviewer
description: Run a dedicated security review pass over backend/frontend code in the Roti Chani System. Use when a change touches auth, JWT handling, money, input validation, CORS, or DB access — or any time a code review needs a security lens.
---

# Security Reviewer — Roti Chani System

Review code for security issues against this project's actual attack surface: an Express + Prisma API with JWT auth, Decimal money, and a React/Vite/Expo client trio.

## The real attack surface

Read these first and review against what actually exists (AI Travel Companion references in old stubs are dead).

- `backend/src/middleware/auth.ts` — JWT verification + `requireAuth`. Check: missing/expired/malformed tokens → 401, not 500; secret from env, never hardcoded.
- `backend/src/config/env.ts` — Zod-validated env. Check: `JWT_SECRET` and `DATABASE_URL` throw at import if missing, per AGENTS.md.
- `backend/src/modules/*` routes — Zod validation on every body. Check: `req.body` is validated not trusted; params/ids parsed as numbers.
- `backend/src/domain/orderMoney.ts` + `utils/money.ts` — integer-cents math. Check: no float arithmetic on prices; Decimal serialized as string never `Number()`.
- `backend/src/db/orderAdapter.ts` — Prisma adapter seam. Check: queries use Prisma params, never string-interpolated SQL; `orderBy`/`where` keys not attacker-controlled.
- `frontend/src/api/client.ts` — token in `Authorization` header, not URL/query/localStorage+XSS vector. Check: logout clears token.
- `docker-compose.yml` + `.env.example` — default creds (`app`/`app_password`, `root`/`root`) flagged for production, JWT secret placeholder.

## Checks to run (backend)

1. **AuthN/AuthZ** — only `/health` and `POST /api/auth/login` are public. `requireAuth` guards everything after `app.use("/api", requireAuth)` (see `src/app.ts`); `GET /api/auth/me` is additionally protected inside the auth router. Verify new routes sit behind one of those guards. No admin-only gating exists today (single shop) — don't invent one without noting it.
2. **Injection** — Prisma parameterized queries only. No `$queryRawUnsafe`/string-built SQL. Zod before DB writes.
3. **Money integrity** — amounts are `Decimal(10,2)` serialized to fixed 2-decimal strings; integer cents internally. Flag any `parseFloat`/`Number()` on prices, or client-trusted totals (subtotal/total are server-computed in `decorateOrder`).
4. **Data exposure** — list responses ship what the client needs (e.g., reports). Flag over-fetching of `passwordHash`.
5. **Rate limiting / brute force** — login has none; flag as a note, not a blocker, for an internal shop.
6. **Secrets** — no secrets in code, tests, git history, or Dockerfiles; env-only.

## Checks to run (frontend/mobile)

1. Token stored in `localStorage` (web) / `expo-secure-store` (mobile) — flag any move to sessionStorage-only or plain storage.
2. No secrets in `VITE_*`/`EXPO_PUBLIC_*` env.
3. `{ error: { code, message } }` parsing — don't render raw server error text into HTML (React escapes by default; style with `textContent`, no `dangerouslySetInnerHTML`).
4. Mobile: note cleartext HTTP is dev-only (Expo Go); APK needs HTTPS — flagged in PROPOSAL_mobile_app.md §6.

## Output

Report findings as `file:line` with severity: **BLOCKER** (must fix), **WARN** (should fix), **NOTE** (context / flagged-limitation). Never fix code during a review pass — report only.