import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/async";
import { errors } from "../../utils/http";
import { validate } from "../../middleware/validate";
import { decorateOrder } from "../../domain/orderMoney";
import { toOrderStatus, WIRE_ORDER_STATUSES } from "../../domain/enums";
import { createOrder, transitionOrderStatus, editOrder } from "../../domain/fulfillment";
import { orderDb, ORDER_WITH } from "../../db/orderAdapter";
import { parsePagination, paginated } from "../../utils/pagination";
import { logActivity } from "../../utils/activityLog";

const router = Router();

const createSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  orderDate: z.string().optional(),
  expectedDeliveryAt: z.string().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive() })).min(1),
});

const editSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  orderDate: z.string().optional(),
  expectedDeliveryAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive() })).min(1),
  acknowledgeUnderTotal: z.boolean().optional(),
});

const statusSchema = z.object({ status: z.enum(WIRE_ORDER_STATUSES) });

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });
const customerIdParamsSchema = z.object({ customerId: z.coerce.number().int().positive() });

// GET /api/orders?page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = parsePagination(req.query);
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { deletedAt: null },
        orderBy: { orderId: "asc" },
        include: ORDER_WITH,
        skip,
        take,
      }),
      prisma.order.count({ where: { deletedAt: null } }),
    ]);
    res.json(paginated(orders.map(decorateOrder), total, page, pageSize));
  }),
);

// GET /api/orders/:id
router.get(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { orderId: Number(req.params.id), deletedAt: null },
      include: ORDER_WITH,
    });
    if (!order) throw errors.notFound("Order not found");
    res.json({ data: decorateOrder(order) });
  }),
);

// GET /api/orders/last/:customerId
router.get(
  "/last/:customerId",
  validate(customerIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const customerId = Number((req.params as { customerId: string }).customerId);
    const order = await prisma.order.findFirst({
      where: { customerId, deletedAt: null },
      orderBy: { orderDate: "desc" },
      include: ORDER_WITH,
    });
    if (!order) throw errors.notFound("No previous orders found for this customer");
    res.json({ data: decorateOrder(order) });
  }),
);

// POST /api/orders
router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const order = await createOrder(orderDb, req.body as z.infer<typeof createSchema>);
    await logActivity({ entityType: "order", entityId: order.orderId, action: "created", description: `Order #${order.orderId} created for customer #${req.body.customerId}` });
    res.status(201).json({ data: decorateOrder(order) });
  }),
);

// PUT /api/orders/:id — full order edit
router.put(
  "/:id",
  validate(paramsSchema, "params"),
  validate(editSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({
      where: { orderId: Number(req.params.id), deletedAt: null },
      include: ORDER_WITH,
    });
    if (!existing) throw errors.notFound("Order not found");

    const body = req.body as z.infer<typeof editSchema>;

    const productRows = await Promise.all(
      body.items.map((item) => prisma.product.findUnique({ where: { productId: item.productId } })),
    );
    const missing = productRows.find((p) => !p);
    if (missing) throw errors.notFound("One or more products not found");

    const paidCents = existing.payments.reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
    const newTotalCents = body.items.reduce((sum, item, i) => {
      return sum + item.quantity * Math.round(Number(productRows[i]!.unitPrice) * 100);
    }, 0);

    if (newTotalCents < paidCents && !body.acknowledgeUnderTotal) {
      throw errors.paidExceedsTotal(
        `New total (RM ${(newTotalCents / 100).toFixed(2)}) is below the already-paid amount (RM ${(paidCents / 100).toFixed(2)}). Confirm to proceed.`,
        { newTotal: (newTotalCents / 100).toFixed(2), paid: (paidCents / 100).toFixed(2) },
      );
    }

    const order = await editOrder(orderDb, Number(req.params.id), {
      customerId: body.customerId,
      orderDate: body.orderDate,
      expectedDeliveryAt: body.expectedDeliveryAt ?? null,
      notes: body.notes ?? null,
      items: body.items,
    });

    const changedCustomer = existing.customerId !== body.customerId;
    await logActivity({
      entityType: "order",
      entityId: order.orderId,
      action: "edited",
      description: `Order #${order.orderId} edited${changedCustomer ? " (customer changed)" : ""}`,
    });
    res.json({ data: decorateOrder(order) });
  }),
);

// PATCH /api/orders/:id/status
router.patch(
  "/:id/status",
  validate(paramsSchema, "params"),
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { orderId: Number(req.params.id), deletedAt: null } });
    if (!existing) throw errors.notFound("Order not found");

    const order = await transitionOrderStatus(orderDb, Number(req.params.id), toOrderStatus(req.body.status));
    await logActivity({ entityType: "order", entityId: order.orderId, action: "status_changed", description: `Order #${order.orderId} status changed: ${existing.status} → ${req.body.status}` });
    res.json({ data: decorateOrder(order) });
  }),
);

// GET /api/orders/:id/invoice
router.get(
  "/:id/invoice",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { orderId: Number(req.params.id), deletedAt: null },
      include: ORDER_WITH,
    });
    if (!order) throw errors.notFound("Order not found");
    res.json({ data: decorateOrder(order) });
  }),
);

// DELETE /api/orders/:id — soft delete
router.delete(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { orderId: Number(req.params.id), deletedAt: null } });
    if (!existing) throw errors.notFound("Order not found");

    await prisma.order.update({
      where: { orderId: Number(req.params.id) },
      data: { deletedAt: new Date() },
    });
    await logActivity({ entityType: "order", entityId: existing.orderId, action: "deleted", description: `Order #${existing.orderId} deleted` });
    res.status(204).send();
  }),
);

// POST /api/orders/:id/restore
router.post(
  "/:id/restore",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { orderId: Number(req.params.id), deletedAt: { not: null } } });
    if (!existing) throw errors.notFound("Order not found or not deleted");

    const order = await prisma.order.update({
      where: { orderId: Number(req.params.id) },
      data: { deletedAt: null },
    });
    await logActivity({ entityType: "order", entityId: order.orderId, action: "restored", description: `Order #${order.orderId} restored` });
    res.json({ data: decorateOrder({ ...order, items: [], payments: [], customer: undefined }) });
  }),
);

export default router;
