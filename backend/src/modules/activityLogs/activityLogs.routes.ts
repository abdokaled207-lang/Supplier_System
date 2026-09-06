import { Router } from "express";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/async";
import { parsePagination, paginated } from "../../utils/pagination";

const router = Router();

// GET /api/activity-logs?page=&pageSize=&entityType=&entityId=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = parsePagination(req.query);
    const where: Record<string, unknown> = {};
    if (req.query.entityType) where.entityType = req.query.entityType as string;
    if (req.query.entityId) where.entityId = Number(req.query.entityId);

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.activityLog.count({ where }),
    ]);

    const formatted = logs.map((log) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata as string) : null,
    }));

    res.json(paginated(formatted, total, page, pageSize));
  }),
);

export default router;
