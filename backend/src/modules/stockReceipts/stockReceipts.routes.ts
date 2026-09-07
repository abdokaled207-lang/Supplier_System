import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/async";
import { errors } from "../../utils/http";
import { validate } from "../../middleware/validate";
import { requireRole } from "../../middleware/auth";
import { parsePagination, paginated } from "../../utils/pagination";
import { logActivity } from "../../utils/activityLog";

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
    const { skip, take, page, pageSize } = parsePagination(req.query);
    const [receipts, total] = await Promise.all([
      prisma.stockReceipt.findMany({
        where: { deletedAt: null },
        orderBy: { receiptId: "asc" },
        include: { product: true },
        skip,
        take,
      }),
      prisma.stockReceipt.count({ where: { deletedAt: null } }),
    ]);
    res.json(paginated(receipts, total, page, pageSize));
  }),
);

// POST /api/stock-receipts
router.post(
  "/",
  requireRole("ADMIN"),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { productId, quantity, receiptDate, notes } = req.body;
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
    res.status(201).json({ data: receipt });
  }),
);

// PUT /api/stock-receipts/:id
router.put(
  "/:id",
  requireRole("ADMIN"),
  validate(paramsSchema, "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.stockReceipt.findUnique({
      where: { receiptId: Number(req.params.id), deletedAt: null },
      include: { product: true },
    });
    if (!existing) throw errors.notFound("Receipt not found");

    const quantityDiff = req.body.quantity !== undefined ? req.body.quantity - existing.quantity : 0;

    const receipt = await prisma.$transaction(async (tx) => {
      const updated = await tx.stockReceipt.update({
        where: { receiptId: Number(req.params.id) },
        data: {
          quantity: req.body.quantity !== undefined ? req.body.quantity : existing.quantity,
          receiptDate: req.body.receiptDate ? new Date(req.body.receiptDate) : existing.receiptDate,
          notes: req.body.notes !== undefined ? req.body.notes : existing.notes,
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
    res.json({ data: receipt });
  }),
);

// DELETE /api/stock-receipts/:id — soft delete + reverse stock
router.delete(
  "/:id",
  requireRole("ADMIN"),
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const receipt = await prisma.stockReceipt.findUnique({
      where: { receiptId: Number(req.params.id), deletedAt: null },
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
    res.status(204).send();
  }),
);

// POST /api/stock-receipts/:id/restore — restore soft-deleted receipt + re-add stock
router.post(
  "/:id/restore",
  requireRole("ADMIN"),
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const receipt = await prisma.stockReceipt.findUnique({
      where: { receiptId: Number(req.params.id), deletedAt: { not: null } },
      include: { product: true },
    });
    if (!receipt) throw errors.notFound("Receipt not found or not deleted");

    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.stockReceipt.update({
        where: { receiptId: Number(req.params.id) },
        data: { deletedAt: null },
      });
      await tx.product.update({
        where: { productId: receipt.productId },
        data: { stockQuantity: { increment: receipt.quantity } },
      });
      return updated;
    });

    await logActivity({ entityType: "stockReceipt", entityId: restored.receiptId, action: "restored", description: `Stock receipt +${receipt.quantity} for "${receipt.product.productName}" restored` });
    res.json({ data: restored });
  }),
);

export default router;
