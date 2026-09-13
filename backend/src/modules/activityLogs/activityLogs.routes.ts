import { Router } from "express";
import { asyncHandler } from "../../utils/async.js";
import { requireRole } from "../../middleware/auth.js";
import { parsePagination, paginated } from "../../utils/pagination.js";
import { listActivityLogs } from "./activityLogs.service.js";

const router = Router();

// GET /api/activity-logs?page=&pageSize=&entityType=&entityId=
router.get(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const page = parsePagination(req.query);
    const { logs, total } = await listActivityLogs(
      {
        entityType: req.query.entityType as string | undefined,
        entityId: req.query.entityId ? Number(req.query.entityId) : undefined,
      },
      page,
    );
    res.json(paginated(logs, total, page.page, page.pageSize));
  }),
);

export default router;
