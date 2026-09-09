import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { errors } from "../utils/http";
import type { CreateOrderData, OrderAdapter, OrderItemRow, OrderRow } from "../domain/fulfillment";

type Handle = Pick<PrismaClient, "order" | "customer" | "product" | "orderItem" | "$transaction">;

export const ORDER_WITH = {
  customer: true,
  items: { include: { product: true } },
  payments: true,
} as const;

function makeAdapter(handle: Handle): OrderAdapter {
  return {
    getCustomer: (customerId) => handle.customer.findUnique({ where: { customerId, deletedAt: null } }),
    getProducts: async (productIds) => {
      if (!productIds.length) return new Map();
      const rows = await handle.product.findMany({ where: { productId: { in: productIds } } });
      return new Map(rows.map((row) => [row.productId, row]));
    },
    getOrder: (orderId) =>
      handle.order.findUnique({ where: { orderId }, include: ORDER_WITH }) as unknown as Promise<OrderRow | null>,
    setOrderStatus: (orderId, status) =>
      handle.order.update({
        where: { orderId },
        data: { status, statusUpdatedAt: new Date() },
        include: ORDER_WITH,
      }) as unknown as Promise<OrderAdapter["setOrderStatus"] extends (id: number, s: unknown) => infer R ? R : never>,
    createOrder: (data: CreateOrderData) => {
      const items: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = data.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: data.unitPrices.get(item.productId)!,
        productName: data.productNames.get(item.productId)!,
      }));
      return handle.order.create({
        data: {
          customerId: data.customerId,
          orderDate: data.orderDate ? new Date(data.orderDate) : undefined,
          expectedDeliveryAt: data.expectedDeliveryAt ? new Date(data.expectedDeliveryAt) : undefined,
          notes: data.notes,
          status: "PENDING",
          statusUpdatedAt: new Date(),
          items: { create: items },
        },
        include: ORDER_WITH,
      }) as unknown as Promise<OrderAdapter["createOrder"] extends (d: unknown) => infer R ? R : never>;
    },
    updateOrder: async (orderId, data: CreateOrderData, _oldItems: OrderItemRow[]) => {
      const items: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = data.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: data.unitPrices.get(item.productId)!,
        productName: data.productNames.get(item.productId)!,
      }));
      return handle.order.update({
        where: { orderId },
        data: {
          customerId: data.customerId,
          orderDate: data.orderDate ? new Date(data.orderDate) : undefined,
          expectedDeliveryAt: data.expectedDeliveryAt === undefined
            ? undefined
            : data.expectedDeliveryAt
              ? new Date(data.expectedDeliveryAt)
              : null,
          notes: data.notes,
          items: { deleteMany: {}, create: items },
        },
        include: ORDER_WITH,
      }) as unknown as Promise<OrderAdapter["updateOrder"] extends (id: number, d: unknown, i: unknown) => infer R ? R : never>;
    },
    decrementStock: async (items) => {
      // Runs inside the transaction opened by runTransaction — no nested
      // $transaction here (Prisma forbids it). The conditional updateMany is
      // the atomic backstop: count 0 means stock went missing mid-flight.
      for (const item of items) {
        const { count } = await handle.product.updateMany({
          where: { productId: item.productId, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (count === 0) {
          throw errors.insufficientStock(`Insufficient stock for product ${item.productId}`);
        }
      }
    },
    incrementStock: (items) =>
      Promise.all(
        items.map((item) =>
          handle.product.update({
            where: { productId: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          }),
        ),
      ).then(() => undefined),
    runTransaction: (fn) => prisma.$transaction((tx) => fn(makeAdapter(tx as unknown as PrismaClient))),
  };
}

export const orderDb: OrderAdapter = makeAdapter(prisma);
