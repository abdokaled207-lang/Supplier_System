import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";

const router = Router();

const searchSchema = z.object({
  q: z.string().min(1).max(200),
});

const LIMIT = 5;

// GET /api/search?q=...
router.get(
  "/",
  validate(searchSchema, "query"),
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string).trim();

    const [customers, products, orders] = await Promise.all([
      prisma.customer.findMany({
        where: {
          deletedAt: null,
          OR: [
            { fullName: { contains: q } },
            { phone: { contains: q } },
          ],
        },
        take: LIMIT,
        orderBy: { customerId: "desc" },
      }),
      prisma.product.findMany({
        where: {
          deletedAt: null,
          OR: [
            { productName: { contains: q } },
          ],
        },
        select: { productId: true, productName: true, imageUrl: true },
        take: LIMIT,
        orderBy: { productId: "desc" },
      }),
      prisma.order.findMany({
        where: {
          deletedAt: null,
          OR: [
            { orderId: Number.isFinite(Number(q)) ? { equals: Number(q) } : undefined },
            { notes: { contains: q } },
          ].filter(Boolean),
        },
        include: { customer: true },
        take: LIMIT,
        orderBy: { orderId: "desc" },
      }),
    ]);

    res.json({
      data: {
        customers,
        products,
        orders: orders.map((o) => ({
          orderId: o.orderId,
          customerName: o.customer?.fullName ?? "—",
          status: o.status,
          orderDate: o.orderDate,
        })),
      },
    });
  }),
);

export default router;
