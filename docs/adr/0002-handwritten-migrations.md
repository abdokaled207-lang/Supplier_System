# Hand-written Prisma migrations when no DB is reachable

`npm run db:dev` cannot run on this machine (no Docker; the MySQL80 service needs admin elevation), so the drop-`Delivery_Areas` migration was written by hand at `backend/prisma/migrations/20260908000000_drop_delivery_areas/migration.sql` in Prisma's folder format. The SQL mirrors what `prisma migrate dev` would generate.

This is an environment limitation, not a preference: never hand-edit an applied migration, and validate hand-written migration SQL against a live DB with `prisma migrate status` / `prisma migrate diff` the next time one is reachable.