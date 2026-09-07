import type { Prisma, PrismaClient } from "@prisma/client";
import { OrderStatus } from "@prisma/client";
import { fromCents, toCents } from "../utils/money";
import { orderTotals } from "../domain/orderMoney";
import type { ReportsAdapter } from "../domain/reports";

type Handle = Pick<PrismaClient, "order" | "customer" | "product" | "orderItem">;

export function buildReportsAdapter(prisma: Prisma.TransactionClient): ReportsAdapter {
  const handle: Handle = prisma as unknown as Handle;

  return {
    async ordersByStatus() {
      const grouped = await handle.order.groupBy({
        by: ["status"],
        _count: { orderId: true },
      });
      return grouped.map((g) => ({ status: g.status, count: g._count.orderId }));
    },

    async customerBalances(range) {
      const where = range ? { orderDate: { gte: range.start, lt: range.end } } : undefined;
      const customers = await handle.customer.findMany({
        include: { orders: { where, include: { items: true, payments: true } } },
      });
      return customers.map((c) => {
        let totalCents = 0;
        let paidCents = 0;
        for (const order of c.orders) {
          const totals = orderTotals(order.items, order.payments);
          totalCents += toCents(totals.total);
          paidCents += toCents(totals.paid);
        }
        return {
          customerId: c.customerId,
          fullName: c.fullName,
          phone: c.phone,
          total: fromCents(totalCents),
          paid: fromCents(paidCents),
          balance: fromCents(totalCents - paidCents),
        };
      });
    },

    async productStock() {
      const products = await handle.product.findMany({
        select: { productId: true, productName: true, unitPrice: true, stockQuantity: true },
      });
      return products.map((p) => ({ productId: p.productId, productName: p.productName, unitPrice: String(p.unitPrice), stockQuantity: p.stockQuantity }));
    },

    async bestSellers(range) {
      const where = range
        ? { order: { orderDate: { gte: range.start, lt: range.end }, status: { not: OrderStatus.CANCELLED } } }
        : { order: { status: { not: OrderStatus.CANCELLED } } };
      const result = await handle.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        where,
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      });
      const productIds = result.map((r) => r.productId);
      const products = await handle.product.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true, productName: true, imageUrl: true },
      });
      const productMap: Record<number, { productName: string; imageUrl: string }> = Object.fromEntries(
        products.map((p) => [p.productId, { productName: p.productName, imageUrl: p.imageUrl }]),
      );
      return result.map((r) => ({
        productId: r.productId,
        productName: productMap[r.productId]?.productName ?? `Product #${r.productId}`,
        imageUrl: productMap[r.productId]?.imageUrl ?? "",
        quantitySold: r._sum?.quantity ?? 0,
      }));
    },

    async todaySales() {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 86_400_000);
      const orders = await handle.order.findMany({
        where: { orderDate: { gte: today, lt: tomorrow }, status: { not: OrderStatus.CANCELLED } },
        include: { items: true, payments: true },
      });
      const totalCents = orders.reduce((sum, o) => sum + toCents(orderTotals(o.items, o.payments).total), 0);
      return { total: fromCents(totalCents), count: orders.length };
    },
  };
}
