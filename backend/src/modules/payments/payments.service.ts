import { prisma } from "../../db/prisma";
import { errors } from "../../utils/http";
import { orderTotals, paymentStatusFor } from "../../domain/orderMoney";
import { toCents } from "../../utils/money";
import { toPaymentType, type WirePaymentType } from "../../domain/enums";
import { logActivity } from "../../utils/activityLog";

export async function listPayments(orderId?: number) {
  const where = orderId !== undefined ? { orderId, deletedAt: null } : { deletedAt: null };
  return prisma.payment.findMany({ where, orderBy: { paymentId: "asc" } });
}

export async function createPayment(input: {
  orderId: number;
  amount: number;
  paymentType: WirePaymentType;
  notes?: string | null;
}) {
  const { orderId, amount, paymentType, notes } = input;
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

  await logActivity({
    entityType: "payment",
    entityId: payment.paymentId,
    action: "payment_recorded",
    description: `Payment RM${amount} recorded for Order #${orderId}`,
    metadata: { orderId, amount, paymentType },
  });
  return payment;
}

export async function softDeletePayment(id: number) {
  const payment = await prisma.payment.findUnique({ where: { paymentId: id, deletedAt: null } });
  if (!payment) throw errors.notFound("Payment not found");

  await prisma.payment.update({ where: { paymentId: id }, data: { deletedAt: new Date() } });
  await logActivity({
    entityType: "payment",
    entityId: payment.paymentId,
    action: "deleted",
    description: `Payment RM${payment.amount} for Order #${payment.orderId} deleted`,
  });
}

export async function restorePayment(id: number) {
  const payment = await prisma.payment.findUnique({ where: { paymentId: id, deletedAt: { not: null } } });
  if (!payment) throw errors.notFound("Payment not found or not deleted");

  const restored = await prisma.payment.update({ where: { paymentId: id }, data: { deletedAt: null } });
  await logActivity({
    entityType: "payment",
    entityId: restored.paymentId,
    action: "restored",
    description: `Payment RM${restored.amount} for Order #${restored.orderId} restored`,
  });
  return restored;
}
