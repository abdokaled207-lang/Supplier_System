import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/async";
import { errors } from "../../utils/http";
import { validate } from "../../middleware/validate";
import { requireRole } from "../../middleware/auth";
import { parsePagination, paginated } from "../../utils/pagination";
import { decorateOrder } from "../../domain/orderMoney";
import { toCents, fromCents } from "../../utils/money";
import { OrderStatus } from "@prisma/client";
import { logActivity } from "../../utils/activityLog";

const router = Router();

const createSchema = z.object({
  fullName: z.string().min(1).max(150),
  phone: z.string().min(1).max(20),
  gpsLink: z
    .string()
    .nullable()
    .optional()
    .refine((val) => val === null || val === undefined || val === "" || val.startsWith("http"), {
      message: "GPS link must start with http",
    }),
  address: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

// GET /api/customers?page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = parsePagination(req.query);
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: { deletedAt: null },
        orderBy: { customerId: "asc" },
        skip,
        take,
      }),
      prisma.customer.count({ where: { deletedAt: null } }),
    ]);
    res.json(paginated(customers, total, page, pageSize));
  }),
);

// GET /api/customers/:id — customer profile with full order history + outstanding balance
router.get(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { customerId: Number(req.params.id), deletedAt: null },
      include: {
        orders: {
          where: { deletedAt: null },
          include: { items: { include: { product: true } }, payments: true },
          orderBy: { orderDate: "desc" },
        },
      },
    });
    if (!customer) throw errors.notFound("Customer not found");

    const decoratedOrders = customer.orders.map(decorateOrder);
    const outstandingCents = decoratedOrders
      .filter((o) => o.status !== OrderStatus.CANCELLED)
      .reduce((sum, o) => sum + toCents(o.balance), 0);

    res.json({
      data: {
        ...customer,
        orders: decoratedOrders,
        outstandingBalance: fromCents(outstandingCents),
      },
    });
  }),
);

// POST /api/customers
router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.create({ data: req.body });
    await logActivity({ entityType: "customer", entityId: customer.customerId, action: "created", description: `Customer "${customer.fullName}" created` });
    res.status(201).json({ data: customer });
  }),
);

// PUT /api/customers/:id
router.put(
  "/:id",
  requireRole("ADMIN"),
  validate(paramsSchema, "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.customer.findUnique({ where: { customerId: Number(req.params.id), deletedAt: null } });
    if (!existing) throw errors.notFound("Customer not found");

    const customer = await prisma.customer.update({
      where: { customerId: Number(req.params.id) },
      data: req.body,
    });
    await logActivity({ entityType: "customer", entityId: customer.customerId, action: "updated", description: `Customer "${customer.fullName}" updated`, metadata: req.body });
    res.json({ data: customer });
  }),
);

// DELETE /api/customers/:id — soft delete
router.delete(
  "/:id",
  requireRole("ADMIN"),
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.customer.findUnique({ where: { customerId: Number(req.params.id), deletedAt: null } });
    if (!existing) throw errors.notFound("Customer not found");

    await prisma.customer.update({
      where: { customerId: Number(req.params.id) },
      data: { deletedAt: new Date() },
    });
    await logActivity({ entityType: "customer", entityId: existing.customerId, action: "deleted", description: `Customer "${existing.fullName}" deleted` });
    res.status(204).send();
  }),
);

// POST /api/customers/:id/restore — restore soft-deleted customer
router.post(
  "/:id/restore",
  requireRole("ADMIN"),
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.customer.findUnique({ where: { customerId: Number(req.params.id), deletedAt: { not: null } } });
    if (!existing) throw errors.notFound("Customer not found or not deleted");

    const customer = await prisma.customer.update({
      where: { customerId: Number(req.params.id) },
      data: { deletedAt: null },
    });
    await logActivity({ entityType: "customer", entityId: customer.customerId, action: "restored", description: `Customer "${customer.fullName}" restored` });
    res.json({ data: customer });
  }),
);

export default router;
