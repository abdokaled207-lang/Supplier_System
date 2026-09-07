import { prisma } from "../../db/prisma";
import { errors } from "../../utils/http";
import { logActivity } from "../../utils/activityLog";

export async function listReceipts(page: { skip: number; take: number; page: number; pageSize: number }) {
  const [receipts, total] = await Promise.all([
    prisma.stockReceipt.findMany({
      where: { deletedAt: null },
      orderBy: { receiptId: "asc" },
      include: { product: true },
      skip: page.skip,
      take: page.take,
    }),
    prisma.stockReceipt.count({ where: { deletedAt: null } }),
  ]);
  return { receipts, total };
}

export async function createReceipt(input: {
  productId: number;
  quantity: number;
  receiptDate?: string;
  notes?: string | null;
}) {
  const { productId, quantity, receiptDate, notes } = input;
  const product = await prisma.product.findUnique({ where: { productId, deletedAt: null }, select: { productId: true, productName: true } });
  if (!product) throw errors.notFound("Product not found");

  const receipt = await prisma.$transaction(async (tx) => {
    const created = await tx.stockReceipt.create({
      data: {
        productId,
        quantity,
        receiptDate: receiptDate ? new Date(receiptDate) : undefined,
        notes,
      },
    });
    await tx.product.update({
      where: { productId },
      data: { stockQuantity: { increment: quantity } },
    });
    return created;
  });

  await logActivity({ entityType: "stockReceipt", entityId: receipt.receiptId, action: "created", description: `Stock receipt +${quantity} for "${product.productName}" created` });
  return receipt;
}

export async function updateReceipt(
  id: number,
  input: { quantity?: number; receiptDate?: string; notes?: string | null },
) {
  const existing = await prisma.stockReceipt.findUnique({
    where: { receiptId: id, deletedAt: null },
    include: { product: true },
  });
  if (!existing) throw errors.notFound("Receipt not found");

  const quantityDiff = input.quantity !== undefined ? input.quantity - existing.quantity : 0;

  const receipt = await prisma.$transaction(async (tx) => {
    const updated = await tx.stockReceipt.update({
      where: { receiptId: id },
      data: {
        quantity: input.quantity !== undefined ? input.quantity : existing.quantity,
        receiptDate: input.receiptDate ? new Date(input.receiptDate) : existing.receiptDate,
        notes: input.notes !== undefined ? input.notes : existing.notes,
      },
    });
    if (quantityDiff !== 0) {
      await tx.product.update({
        where: { productId: existing.productId },
        data: { stockQuantity: { increment: quantityDiff } },
      });
    }
    return updated;
  });

  await logActivity({
    entityType: "stockReceipt",
    entityId: receipt.receiptId,
    action: "updated",
    description: `Stock receipt for "${existing.product.productName}" updated${quantityDiff !== 0 ? `: ${quantityDiff > 0 ? "+" : ""}${quantityDiff} units` : ""}`,
  });
  return receipt;
}

export async function softDeleteReceipt(id: number) {
  const receipt = await prisma.stockReceipt.findUnique({
    where: { receiptId: id, deletedAt: null },
    include: { product: true },
  });
  if (!receipt) throw errors.notFound("Receipt not found");

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { productId: receipt.productId },
      data: { stockQuantity: { decrement: receipt.quantity } },
    });
    await tx.stockReceipt.update({
      where: { receiptId: receipt.receiptId },
      data: { deletedAt: new Date() },
    });
  });

  await logActivity({ entityType: "stockReceipt", entityId: receipt.receiptId, action: "deleted", description: `Stock receipt -${receipt.quantity} for "${receipt.product.productName}" deleted` });
}

export async function restoreReceipt(id: number) {
  const receipt = await prisma.stockReceipt.findUnique({
    where: { receiptId: id, deletedAt: { not: null } },
    include: { product: true },
  });
  if (!receipt) throw errors.notFound("Receipt not found or not deleted");

  const restored = await prisma.$transaction(async (tx) => {
    const updated = await tx.stockReceipt.update({
      where: { receiptId: id },
      data: { deletedAt: null },
    });
    await tx.product.update({
      where: { productId: receipt.productId },
      data: { stockQuantity: { increment: receipt.quantity } },
    });
    return updated;
  });

  await logActivity({ entityType: "stockReceipt", entityId: restored.receiptId, action: "restored", description: `Stock receipt +${receipt.quantity} for "${receipt.product.productName}" restored` });
  return restored;
}
