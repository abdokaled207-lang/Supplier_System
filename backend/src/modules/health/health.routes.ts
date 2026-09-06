import { Router } from "express";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/async";

const router = Router();

// GET /api/health — public liveness + DB reachability.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "connected" });
    } catch {
      res.status(503).json({ status: "error", db: "unreachable" });
    }
  }),
);

export default router;