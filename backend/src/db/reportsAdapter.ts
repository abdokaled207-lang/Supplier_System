import type { Prisma, PrismaClient } from "@prisma/client";
import { OrderStatus } from "@prisma/client";
import { fromCents, toCents } from "../utils/money";
import { orderTotals } from "../domain/orderMoney";
import type { ReportsAdapter } from "../domain/reports";

type Handle = Pick<PrismaClient, "order" | "customer" | "product" | "orderItem">;

export function buildReportsAdapter(prisma: Prisma.TransactionClient): ReportsAdapter {
  const handle: Handle = prisma as unknown as Handle;

  async function ordersByStatus() {
    const grouped = await handle.order.groupBy({
      by: ["status"],
      _count: { orderId: true },
    });
    return grouped.map((g) => ({ status: g.status, count: g._count.orderId }));
  }

  async function customerBalances(range?: { start: Date; end: Date }) {
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
  }

  async function productStock() {
    const products = await handle.product.findMany({
      select: { productId: true, productName: true, unitPrice: true, stockQuantity: true },
    });
    return products.map((p) => ({ productId: p.productId, productName: p.productName, unitPrice: String(p.unitPrice), stockQuantity: p.stockQuantity }));
  }

  async function bestSellers(range?: { start: Date; end: Date }) {
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
  }

  async function todaySales() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const orders = await handle.order.findMany({
      where: { orderDate: { gte: today, lt: tomorrow }, status: { not: OrderStatus.CANCELLED } },
      include: { items: true, payments: true },
    });
    const totalCents = orders.reduce((sum, o) => sum + toCents(orderTotals(o.items, o.payments).total), 0);
    return { total: fromCents(totalCents), count: orders.length };
  }

  async function dashboard(lowStockThreshold: number) {
    const notDeleted = { deletedAt: null };
    const [grouped, revenueOrders, balances, products, today] = await Promise.all([
      handle.order.groupBy({ by: ["status"], _count: { orderId: true }, where: notDeleted }),
      handle.order.findMany({
        where: { ...notDeleted, status: { not: OrderStatus.CANCELLED } },
        include: { items: true, payments: true },
      }),
      customerBalances(),
      handle.product.findMany({ where: notDeleted, orderBy: { productId: "asc" } }),
      todaySales(),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const status of Object.values(OrderStatus)) statusCounts[status] = 0;
    let totalOrders = 0;
    for (const g of grouped) {
      statusCounts[g.status] = g._count.orderId;
      totalOrders += g._count.orderId;
    }

    const revenueCents = revenueOrders.reduce((sum, o) => sum + toCents(orderTotals(o.items, o.payments).total), 0);

    return {
      totalOrders,
      statusCounts,
      openOrders: statusCounts.PENDING + statusCounts.PROCESSING + statusCounts.SHIPPED,
      revenue: fromCents(revenueCents),
      outstanding: fromCents(balances.reduce((sum, b) => sum + toCents(b.balance), 0)),
      todaySales: today,
      lowStock: products
        .filter((p) => p.stockQuantity <= lowStockThreshold)
        .map((p) => ({ productId: p.productId, productName: p.productName, imageUrl: p.imageUrl, stockQuantity: p.stockQuantity })),
    };
  }

  return {
    ordersByStatus,
    customerBalances,
    productStock,
    bestSellers,
    todaySales,
    dashboard,
  };
}
