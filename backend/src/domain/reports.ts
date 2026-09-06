import type { Prisma } from "@prisma/client";
import { OrderStatus } from "@prisma/client";
import { fromCents, toCents } from "../utils/money";
import { orderTotals } from "./orderMoney";

export interface ReportsAdapter {
  ordersByStatus(): Promise<{ status: string; count: number }[]>;
  customerBalances(range?: DateRange): Promise<{ customerId: number; fullName: string; phone: string; total: string; paid: string; balance: string }[]>;
  productStock(): Promise<{ productId: number; productName: string; unitPrice: string; stockQuantity: number }[]>;
  bestSellers(range?: DateRange): Promise<{ productId: number; productName: string; imageUrl: string; quantitySold: number }[]>;
  todaySales(): Promise<{ total: string; count: number }>;
}

export interface DateRange {
  start: Date;
  end: Date;
}

function buildDateRange(range?: string): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86_400_000);

  if (range === "daily") {
    return { start: today, end: tomorrow };
  }
  if (range === "weekly") {
    const dayOfWeek = today.getDay();
    const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 86_400_000);
    return { start: monday, end: tomorrow };
  }
  if (range === "monthly") {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: firstOfMonth, end: tomorrow };
  }
  return { start: new Date(0), end: tomorrow };
}

export function parseRangeParams(query: Record<string, unknown>): DateRange | undefined {
  const range = String(query.range ?? "");
  if (range === "custom") {
    const start = String(query.start ?? "");
    const end = String(query.end ?? "");
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        return { start: s, end: new Date(e.getTime() + 86_400_000) };
      }
    }
    return undefined;
  }
  if (["daily", "weekly", "monthly"].includes(range)) {
    return buildDateRange(range);
  }
  return undefined;
}

export function buildReportsAdapter(prisma: Prisma.TransactionClient): ReportsAdapter {
  return {
    async ordersByStatus() {
      const grouped = await prisma.order.groupBy({
        by: ["status"],
        _count: { orderId: true },
      });
      return grouped.map((g) => ({ status: g.status, count: g._count.orderId }));
    },

    async customerBalances(range) {
      const where = range ? { orderDate: { gte: range.start, lt: range.end } } : {};
      const customers = await prisma.customer.findMany({
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
      const products = await prisma.product.findMany({
        select: { productId: true, productName: true, unitPrice: true, stockQuantity: true },
      });
      return products.map((p) => ({ productId: p.productId, productName: p.productName, unitPrice: String(p.unitPrice), stockQuantity: p.stockQuantity }));
    },

    async bestSellers(range) {
      const where = range ? { order: { orderDate: { gte: range.start, lt: range.end }, status: { not: OrderStatus.CANCELLED } } } : { order: { status: { not: OrderStatus.CANCELLED } } };
      const result = await prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        where,
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      });
      const productIds = result.map((r) => r.productId);
      const products = await prisma.product.findMany({
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
      const orders = await prisma.order.findMany({
        where: {
          orderDate: { gte: today, lt: tomorrow },
          status: { not: OrderStatus.CANCELLED },
        },
        include: { items: true, payments: true },
      });
      const totalCents = orders.reduce((sum, o) => sum + toCents(orderTotals(o.items, o.payments).total), 0);
      return { total: fromCents(totalCents), count: orders.length };
    },
  };
}
