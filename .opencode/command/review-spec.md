---
description: Compliance review of a proposal, schema, plan, or design against the Roti Chani source of truth (AGENTS.md, CONTEXT.md, README.md, schema.prisma, domain modules) — flags anything undefined as REQUIRES ADR.
agent: spec-guardian
---

Review the following strictly against the project's source-of-truth documents — `AGENTS.md` (architecture + business rules), `CONTEXT.md` (domain vocabulary), `README.md` (API surface), `backend/prisma/schema.prisma` (live schema), and `backend/src/domain/*` (business rules). Structure the review exactly as: Approved items / Items requiring ADR-clarification / Flagged deviations, each with exact file + section citations.

Subject to review:

$ARGUMENTS