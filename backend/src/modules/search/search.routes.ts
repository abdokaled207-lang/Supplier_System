import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { searchAll } from "./search.service";

const router = Router();

const searchSchema = z.object({
  q: z.string().min(1).max(200),
});

// GET /api/search?q=...
router.get(
  "/",
  validate(searchSchema, "query"),
  asyncHandler(async (req, res) => {
    const data = await searchAll(req.query.q as string);
    res.json({ data });
  }),
);

export default router;
