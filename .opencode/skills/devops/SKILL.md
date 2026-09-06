---
name: devops
description: Infrastructure and CI/CD work for the Roti Chani System — Docker (MySQL 8 via docker-compose), GitHub Actions, environment management. Use for deployment, containerization, CI, or environment setup tasks.
---

# DevOps — Roti Chani System

Infrastructure guidance for the actual repo. The AI Travel Companion "Tech Spec §1" references in old stubs are dead — this is a small three-app shop.

## The environment (read first)

- **MySQL 8**: two options — Docker (`docker compose up -d db`, container `roti_chani_db`) or the local MySQL80 Windows service. On the dev machine **Docker is not installed** and starting MySQL80 needs admin elevation — so `prisma migrate`/`seed` can fail on this machine for environment reasons, not code bugs (AGENTS.md §Gotchas).
- **Three apps**: `backend/` (Express :4000), `frontend/` (Vite :5173, proxies /api → :4000), `mobile/` (Expo, talks to Tailscale IP `100.77.24.16:4000`). Not npm workspaces — `cd` into each.
- `.env.example` is the template; `DATABASE_URL` differs for Docker vs local MySQL80.

## Docker

- `docker-compose.yml` currently ships only the `db` service (MySQL 8, utf8mb4, named volume, healthcheck). Extending it with `backend`/`frontend` services is deferred — **do not** add services without confirming with the user (Phases 4-5 pending ADRs).
- Backend Dockerfile, if added: multi-stage, `npm ci` with allowScripts approval noted, run migrations/seed before `start`, bind `0.0.0.0`.
- Frontend Dockerfile, if added: `npm ci` → `vite build` → nginx serving `dist`, proxy `/api` to backend.
- Never bake `.env` values (JWT secret, DB password) into images — real secrets via env vars / docker secrets.

## CI (GitHub Actions)

- The repo is a git repo (`.git` present) but has no CI yet (no `.github/`). If CI is added, the contract is the documented commands per workspace (AGENTS.md §Commands): backend `typecheck + lint + test`, frontend `typecheck + lint + build + test`. `npm test` must stay DB-free in backend (exclude `tests/integration/`).
- MySQL service container in CI is optional; the default suites must not need it.

## Env hygiene

- Root `.env.example` stays the source of truth template; no secrets committed.
- `npm approve-scripts` gate (Prisma postinstall, esbuild) on this machine — after `npm install`, document/recall `npm approve-scripts @prisma/client prisma @prisma/engines esbuild` or `prisma generate` breaks (AGENTS.md §Commands).