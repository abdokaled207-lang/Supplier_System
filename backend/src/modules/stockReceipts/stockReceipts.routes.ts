import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async.js";
import { validate } from "../../middleware/validate.js";
import { requireAdmin } from "../../middleware/auth.js";
import { parsePagination, paginated } from "../../utils/pagination.js";
import {
  createReceipt,
  listReceipts,
  restoreReceipt,
  softDeleteReceipt,
  updateReceipt,
} from "./stockReceipts.service.js";

const router = Router();

const createSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  receiptDate: z.string().optional(),
  notes: z.string().nullable().optional(),
});

const updateSchema = z.object({
  quantity: z.coerce.number().int().positive().optional(),
  receiptDate: z.string().optional(),
  notes: z.string().nullable().optional(),
});

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

// GET /api/stock-receipts?page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = parsePagination(req.query);
    const { receipts, total } = await listReceipts(page);
    res.json(paginated(receipts, total, page.page, page.pageSize));
  }),
);

// POST /api/stock-receipts
router.post(
  "/",
  requireAdmin,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const receipt = await createReceipt(req.body as z.infer<typeof createSchema>);
    res.status(201).json({ data: receipt });
  }),
);

// PUT /api/stock-receipts/:id
router.put(
  "/:id",
  requireAdmin,
  validate(paramsSchema, "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const receipt = await updateReceipt(Number(req.params.id), req.body as z.infer<typeof updateSchema>);
    res.json({ data: receipt });
  }),
);

// DELETE /api/stock-receipts/:id — soft delete + reverse stock
router.delete(
  "/:id",
  requireAdmin,
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    await softDeleteReceipt(Number(req.params.id));
    res.status(204).send();
  }),
);

// POST /api/stock-receipts/:id/restore — restore soft-deleted receipt + re-add stock
router.post(
  "/:id/restore",
  requireAdmin,
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const restored = await restoreReceipt(Number(req.params.id));
    res.json({ data: restored });
  }),
);

export default router;
