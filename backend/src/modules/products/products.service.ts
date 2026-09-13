import { prisma } from "../../db/prisma.js";
import { errors } from "../../utils/http.js";
import { logActivity } from "../../utils/activityLog.js";
import { fromCents, toCents } from "../../utils/money.js";

const PRODUCT_SUMMARY_SELECT = {
  productId: true,
  productName: true,
  unitPrice: true,
  stockQuantity: true,
  imageUrl: true,
} as const;

export async function listProducts(page: { skip: number; take: number }) {
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { productId: "asc" },
      skip: page.skip,
      take: page.take,
      select: { ...PRODUCT_SUMMARY_SELECT, createdAt: true, deletedAt: true },
    }),
    prisma.product.count({ where: { deletedAt: null } }),
  ]);
  return { products, total };
}

export async function getProduct(id: number) {
  const product = await prisma.product.findUnique({
    where: { productId: id, deletedAt: null },
    select: PRODUCT_SUMMARY_SELECT,
  });
  if (!product) throw errors.notFound("Product not found");
  return product;
}

export async function getProductWithRecentOrders(id: number) {
  const product = await getProduct(id);

  const ordersWithProduct = await prisma.orderItem.findMany({
    where: { productId: id, order: { deletedAt: null } },
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

  return { product, orders };
}

export async function createProduct(data: { productName: string; unitPrice: number; stockQuantity?: number; imageUrl?: string }) {
  const product = await prisma.product.create({ data });
  await logActivity({ entityType: "product", entityId: product.productId, action: "created", description: `Product "${product.productName}" created` });
  return product;
}

export async function updateProduct(id: number, body: { productName?: string; unitPrice?: number; imageUrl?: string }) {
  const existing = await prisma.product.findUnique({
    where: { productId: id, deletedAt: null },
    select: { productId: true, productName: true, unitPrice: true, imageUrl: true },
  });
  if (!existing) throw errors.notFound("Product not found");

  const updateData: { productName?: string; unitPrice?: number; imageUrl?: string } = {};
  if (body.productName !== undefined) updateData.productName = body.productName;
  if (body.unitPrice !== undefined) updateData.unitPrice = body.unitPrice;
  if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;

  const product = await prisma.product.update({ where: { productId: id }, data: updateData });

  const changes: string[] = [];
  if (body.productName && body.productName !== existing.productName) {
    changes.push(`name: "${existing.productName}" → "${body.productName}"`);
  }
  if (body.unitPrice !== undefined && Number(body.unitPrice) !== Number(existing.unitPrice)) {
    changes.push(`price: RM${existing.unitPrice} → RM${body.unitPrice}`);
  }
  if (body.imageUrl !== undefined && body.imageUrl !== existing.imageUrl) {
    changes.push(`image updated`);
  }

  await logActivity({
    entityType: "product",
    entityId: product.productId,
    action: "updated",
    description: `Product "${product.productName}" updated${changes.length ? `: ${changes.join(", ")}` : ""}`,
    metadata: body,
  });
  return product;
}

export async function softDeleteProduct(id: number) {
  const existing = await prisma.product.findUnique({
    where: { productId: id, deletedAt: null },
    select: { productId: true, productName: true },
  });
  if (!existing) throw errors.notFound("Product not found");

  await prisma.product.update({ where: { productId: id }, data: { deletedAt: new Date() } });
  await logActivity({ entityType: "product", entityId: existing.productId, action: "deleted", description: `Product "${existing.productName}" deleted` });
}

export async function restoreProduct(id: number) {
  const existing = await prisma.product.findUnique({
    where: { productId: id, deletedAt: { not: null } },
    select: { productId: true, productName: true },
  });
  if (!existing) throw errors.notFound("Product not found or not deleted");

  const product = await prisma.product.update({ where: { productId: id }, data: { deletedAt: null } });
  await logActivity({ entityType: "product", entityId: product.productId, action: "restored", description: `Product "${product.productName}" restored` });
  return product;
}
