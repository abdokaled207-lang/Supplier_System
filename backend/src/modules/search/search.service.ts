import { prisma } from "../../db/prisma.js";

const LIMIT = 5;

export async function searchAll(rawQuery: string) {
  const q = rawQuery.trim();

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

  return {
    customers,
    products,
    orders: orders.map((o) => ({
      orderId: o.orderId,
      customerName: o.customer?.fullName ?? "—",
      status: o.status,
      orderDate: o.orderDate,
    })),
  };
}
