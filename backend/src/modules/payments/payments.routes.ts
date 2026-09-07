import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { requireAdmin } from "../../middleware/auth";
import { WIRE_PAYMENT_TYPES } from "../../domain/enums";
import { createPayment, listPayments, restorePayment, softDeletePayment } from "./payments.service";

const router = Router();

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

const createSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  amount: z.coerce.number().min(0),
  paymentType: z.enum(WIRE_PAYMENT_TYPES),
  notes: z.string().nullable().optional(),
});

// POST /api/payments
router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const payment = await createPayment(req.body as z.infer<typeof createSchema>);
    res.status(201).json({ data: payment });
  }),
);

// GET /api/payments?orderId=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const orderId = Number(req.query.orderId);
    const payments = await listPayments(Number.isFinite(orderId) ? orderId : undefined);
    res.json({ data: payments });
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
