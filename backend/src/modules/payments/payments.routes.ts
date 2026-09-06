import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/async";
import { errors } from "../../utils/http";
import { validate } from "../../middleware/validate";
import { orderTotals, paymentStatusFor } from "../../domain/orderMoney";
import { toCents } from "../../utils/money";
import { toPaymentType, WIRE_PAYMENT_TYPES } from "../../domain/enums";
import { logActivity } from "../../utils/activityLog";

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
    const { orderId, amount, paymentType, notes } = req.body as z.infer<typeof createSchema>;
    const order = await prisma.order.findUnique({ where: { orderId, deletedAt: null }, include: { items: true } });
    if (!order) throw errors.notFound("Order not found");

    const totalCents = toCents(orderTotals(order.items, []).total);
    const paidSoFar = await prisma.payment.aggregate({ where: { orderId, deletedAt: null }, _sum: { amount: true } });
    const paidCents = toCents(paidSoFar._sum.amount ?? 0) + toCents(amount);

    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount,
        paymentType: toPaymentType(paymentType),
        notes,
        paymentStatus: paymentStatusFor(totalCents, paidCents),
      },
    });

    await logActivity({ entityType: "payment", entityId: payment.paymentId, action: "payment_recorded", description: `Payment RM${amount} recorded for Order #${orderId}`, metadata: { orderId, amount, paymentType } });
    res.status(201).json({ data: payment });
  }),
);

// GET /api/payments?orderId=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const orderId = Number(req.query.orderId);
    const payments = Number.isFinite(orderId)
      ? await prisma.payment.findMany({ where: { orderId, deletedAt: null }, orderBy: { paymentId: "asc" } })
      : await prisma.payment.findMany({ where: { deletedAt: null }, orderBy: { paymentId: "asc" } });
    res.json({ data: payments });
  }),
);

// DELETE /api/payments/:id — soft delete
router.delete(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { paymentId: Number(req.params.id), deletedAt: null } });
    if (!payment) throw errors.notFound("Payment not found");

    await prisma.payment.update({
      where: { paymentId: Number(req.params.id) },
      data: { deletedAt: new Date() },
    });
    await logActivity({ entityType: "payment", entityId: payment.paymentId, action: "deleted", description: `Payment RM${payment.amount} for Order #${payment.orderId} deleted` });
    res.status(204).send();
  }),
);

// POST /api/payments/:id/restore
router.post(
  "/:id/restore",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { paymentId: Number(req.params.id), deletedAt: { not: null } } });
    if (!payment) throw errors.notFound("Payment not found or not deleted");

    const restored = await prisma.payment.update({
      where: { paymentId: Number(req.params.id) },
      data: { deletedAt: null },
    });
    await logActivity({ entityType: "payment", entityId: restored.paymentId, action: "restored", description: `Payment RM${restored.amount} for Order #${restored.orderId} restored` });
    res.json({ data: restored });
  }),
);

export default router;
