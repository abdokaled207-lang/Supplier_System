---
description: Run the full test + verification suite for the Roti Chani System — backend (DB-free unit/app tests), frontend, and optionally the mobile workspace.
---

Run verification across the Roti Chani workspaces.

1. **Backend** (`backend/`): `npm run typecheck && npm run lint && npm test` — the default `npm test` must stay DB-free (excludes `tests/integration/`).
2. **Frontend** (`frontend/`): `npm run typecheck && npm run lint && npm run build && npm test`.
3. **Mobile** (`mobile/`, if requested): `npm run typecheck && npm run lint && npm test`.
4. Report each command's result as PASS/FAIL with the failing command, not just a pass/fail summary.

Note (AGENTS.md §Gotchas): DB-dependent commands (`db:migrate`, `db:seed`, `test:integration`) can fail on a machine with no reachable MySQL (Docker not installed; MySQL80 needs elevation) — that is an environment limitation, not a code failure.

$ARGUMENTS