import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/async";
import { errors } from "../../utils/http";
import { validate } from "../../middleware/validate";
import { parsePagination, paginated } from "../../utils/pagination";
import { logActivity } from "../../utils/activityLog";
import { fromCents, toCents } from "../../utils/money";

const router = Router();

const createSchema = z.object({
  productName: z.string().min(1).max(150),
  unitPrice: z.coerce.number().min(0),
  stockQuantity: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().max(500).optional(),
});

const updateSchema = z.object({
  productName: z.string().min(1).max(150).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  imageUrl: z.string().max(500).optional(),
});

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

// GET /api/products?page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = parsePagination(req.query);
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { deletedAt: null },
        orderBy: { productId: "asc" },
        skip,
        take,
        select: { productId: true, productName: true, unitPrice: true, stockQuantity: true, imageUrl: true, createdAt: true, deletedAt: true },
      }),
      prisma.product.count({ where: { deletedAt: null } }),
    ]);
    res.json(paginated(products, total, page, pageSize));
  }),
);

// GET /api/products/:id/orders — product detail with recent orders
router.get(
  "/:id/orders",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { productId: Number(req.params.id), deletedAt: null },
      select: { productId: true, productName: true, unitPrice: true, stockQuantity: true, imageUrl: true },
    });
    if (!product) throw errors.notFound("Product not found");

    const ordersWithProduct = await prisma.orderItem.findMany({
      where: { productId: Number(req.params.id), order: { deletedAt: null } },
      include: { order: { include: { customer: true } } },
      orderBy: { order: { orderDate: "desc" } },
      take: 20,
    });

    const orders = ordersWithProduct.map((oi) => ({
      orderId: oi.order.orderId,
      orderDate: oi.order.orderDate,
      status: oi.order.status,
      customerName: oi.order.customer?.fullName ?? "—",
      quantity: oi.quantity,
      subtotal: fromCents(toCents(oi.unitPrice) * oi.quantity),
    }));

    res.json({ data: { product, orders } });
  }),
);

// GET /api/products/:id
router.get(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { productId: Number(req.params.id), deletedAt: null },
      select: { productId: true, productName: true, unitPrice: true, stockQuantity: true, imageUrl: true },
    });
    if (!product) throw errors.notFound("Product not found");
    res.json({ data: product });
  }),
);

// POST /api/products
router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.create({ data: req.body });
    await logActivity({ entityType: "product", entityId: product.productId, action: "created", description: `Product "${product.productName}" created` });
    res.status(201).json({ data: product });
  }),
);

// PUT /api/products/:id
router.put(
  "/:id",
  validate(paramsSchema, "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({
      where: { productId: Number(req.params.id), deletedAt: null },
      select: { productId: true, productName: true, unitPrice: true, imageUrl: true },
    });
    if (!existing) throw errors.notFound("Product not found");

    const updateData: { productName?: string; unitPrice?: number; imageUrl?: string } = {};
    if (req.body.productName !== undefined) updateData.productName = req.body.productName;
    if (req.body.unitPrice !== undefined) updateData.unitPrice = req.body.unitPrice;
    if (req.body.imageUrl !== undefined) updateData.imageUrl = req.body.imageUrl;

    const product = await prisma.product.update({
      where: { productId: Number(req.params.id) },
      data: updateData,
    });

    const changes: string[] = [];
    if (req.body.productName && req.body.productName !== existing.productName) {
      changes.push(`name: "${existing.productName}" → "${req.body.productName}"`);
    }
    if (req.body.unitPrice !== undefined && Number(req.body.unitPrice) !== Number(existing.unitPrice)) {
      changes.push(`price: RM${existing.unitPrice} → RM${req.body.unitPrice}`);
    }
    if (req.body.imageUrl !== undefined && req.body.imageUrl !== existing.imageUrl) {
      changes.push(`image updated`);
    }

    await logActivity({
      entityType: "product",
      entityId: product.productId,
      action: "updated",
      description: `Product "${product.productName}" updated${changes.length ? `: ${changes.join(", ")}` : ""}`,
      metadata: req.body,
    });

    res.json({ data: product });
  }),
);

// DELETE /api/products/:id — soft delete
router.delete(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({
      where: { productId: Number(req.params.id), deletedAt: null },
      select: { productId: true, productName: true },
    });
    if (!existing) throw errors.notFound("Product not found");

    await prisma.product.update({
      where: { productId: Number(req.params.id) },
      data: { deletedAt: new Date() },
    });
    await logActivity({ entityType: "product", entityId: existing.productId, action: "deleted", description: `Product "${existing.productName}" deleted` });
    res.status(204).send();
  }),
);

// POST /api/products/:id/restore — restore soft-deleted product
router.post(
  "/:id/restore",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({
      where: { productId: Number(req.params.id), deletedAt: { not: null } },
      select: { productId: true, productName: true },
    });
    if (!existing) throw errors.notFound("Product not found or not deleted");

    const product = await prisma.product.update({
      where: { productId: Number(req.params.id) },
      data: { deletedAt: null },
    });
    await logActivity({ entityType: "product", entityId: product.productId, action: "restored", description: `Product "${product.productName}" restored` });
    res.json({ data: product });
  }),
);

export default router;
