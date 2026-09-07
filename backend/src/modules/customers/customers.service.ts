import { prisma } from "../../db/prisma";
import { errors } from "../../utils/http";
import { decorateOrder } from "../../domain/orderMoney";
import { toCents, fromCents } from "../../utils/money";
import { OrderStatus } from "@prisma/client";
import { logActivity } from "../../utils/activityLog";

export async function listCustomers(page: { skip: number; take: number }) {
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null },
      orderBy: { customerId: "asc" },
      skip: page.skip,
      take: page.take,
    }),
    prisma.customer.count({ where: { deletedAt: null } }),
  ]);
  return { customers, total };
}

export async function getCustomerProfile(id: number) {
  const customer = await prisma.customer.findUnique({
    where: { customerId: id, deletedAt: null },
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
  // "Baki Tertunggak": sum of non-cancelled order balances (total - paid), integer cents.
  const outstandingCents = decoratedOrders
    .filter((o) => o.status !== OrderStatus.CANCELLED)
    .reduce((sum, o) => sum + toCents(o.balance), 0);

  return {
    ...customer,
    orders: decoratedOrders,
    outstandingBalance: fromCents(outstandingCents),
  };
}

export async function createCustomer(data: { fullName: string; phone: string; gpsLink?: string | null; address?: string | null; area?: string | null }) {
  const customer = await prisma.customer.create({ data });
  await logActivity({ entityType: "customer", entityId: customer.customerId, action: "created", description: `Customer "${customer.fullName}" created` });
  return customer;
}

export async function updateCustomer(id: number, data: Partial<{ fullName: string; phone: string; gpsLink?: string | null; address?: string | null; area?: string | null }>) {
  const existing = await prisma.customer.findUnique({ where: { customerId: id, deletedAt: null } });
  if (!existing) throw errors.notFound("Customer not found");

  const customer = await prisma.customer.update({ where: { customerId: id }, data });
  await logActivity({ entityType: "customer", entityId: customer.customerId, action: "updated", description: `Customer "${customer.fullName}" updated`, metadata: data });
  return customer;
}

export async function softDeleteCustomer(id: number) {
  const existing = await prisma.customer.findUnique({ where: { customerId: id, deletedAt: null } });
  if (!existing) throw errors.notFound("Customer not found");

  await prisma.customer.update({ where: { customerId: id }, data: { deletedAt: new Date() } });
  await logActivity({ entityType: "customer", entityId: existing.customerId, action: "deleted", description: `Customer "${existing.fullName}" deleted` });
}

export async function restoreCustomer(id: number) {
  const existing = await prisma.customer.findUnique({ where: { customerId: id, deletedAt: { not: null } } });
  if (!existing) throw errors.notFound("Customer not found or not deleted");

  const customer = await prisma.customer.update({ where: { customerId: id }, data: { deletedAt: null } });
  await logActivity({ entityType: "customer", entityId: customer.customerId, action: "restored", description: `Customer "${customer.fullName}" restored` });
  return customer;
}
