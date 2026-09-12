import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { requireAdmin } from "../../middleware/auth";
import { parsePagination, paginated } from "../../utils/pagination";
import { WIRE_PAYMENT_TYPES } from "../../domain/enums";
import { createPayment, listPayments, listPaymentsForOrder, restorePayment, softDeletePayment } from "./payments.service";

const router = Router();

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

const createSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  paymentType: z.enum(WIRE_PAYMENT_TYPES),
  notes: z.string().nullable().optional(),
});

// POST /api/payments — admin-only, matching every other mutation endpoint
router.post(
  "/",
  requireAdmin,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const payment = await createPayment(req.body as z.infer<typeof createSchema>);
    res.status(201).json({ data: payment });
  }),
);

// GET /api/payments?orderId= — per-order list, or the full paginated list
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const raw = Number(req.query.orderId);
    if (Number.isFinite(raw)) {
      const payments = await listPaymentsForOrder(raw);
      res.json({ data: payments });
      return;
    }
    const page = parsePagination(req.query);
    const { payments, total } = await listPayments(page);
    res.json(paginated(payments, total, page.page, page.pageSize));
  }),
);

// DELETE /api/payments/:id — soft delete
router.delete(
  "/:id",
  requireAdmin,
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    await softDeletePayment(Number(req.params.id));
    res.status(204).send();
  }),
);

// POST /api/payments/:id/restore
router.post(
  "/:id/restore",
  requireAdmin,
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const restored = await restorePayment(Number(req.params.id));
    res.json({ data: restored });
  }),
);

export default router;
