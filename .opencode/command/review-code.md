---
description: Review the current work-in-progress changes in the Roti Chani System — run typecheck + lint + test in the affected workspaces, then review the diff.
---

Review the current changes in the Roti Chani System.

1. Run verification in the affected workspace(s) first:
   - Backend (`backend/`): `npm run typecheck && npm run lint && npm test`
   - Frontend (`frontend/`): `npm run typecheck && npm run lint && npm run build && npm test`
2. Review the diff against:
   - Standards: the repo's documented coding standards (`AGENTS.md`, plus the relevant skill — architecture-reviewer, api-contract-engineer, test-engineer, security-reviewer).
   - Spec: what the originating request asked for.
3. Report findings as `file:line` with severity (BLOCKER / WARN / NOTE). End with a verdict: approve or changes-requested.

$ARGUMENTS