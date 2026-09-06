import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@prisma/client";
import type { Money } from "../src/utils/money";
import { createOrder, editOrder, transitionOrderStatus, type OrderAdapter, type OrderRow } from "../src/domain/fulfillment";

interface FakeProduct {
  productId: number;
  productName: string;
  stockQuantity: number;
  unitPrice: Money;
}

// Second adapter at the seam (in addition to the Prisma-backed one) — the in-memory
// fake that lets the stock-on-delivery rules be unit-tested through the interface.
function makeFakeDb() {
  const products = new Map<number, FakeProduct>();
  const orders = new Map<number, OrderRow>();
  let nextOrderId = 1;
  let nextItemId = 1;

  const db: OrderAdapter = {
    getCustomer: async (customerId) => (customerId > 0 ? { customerId } : null),
    getProduct: async (productId) => products.get(productId) ?? null,
    getOrder: async (orderId) => orders.get(orderId) ?? null,
    setOrderStatus: async (orderId, status) => {
      const order = orders.get(orderId);
      if (!order) throw new Error("not found");
      order.status = status;
      return { ...order, items: [...order.items] };
    },
    createOrder: async (data) => {
      const row: OrderRow = {
        orderId: nextOrderId++,
        customerId: data.customerId,
        status: "PENDING",
        notes: data.notes,
        items: data.items.map((item) => ({
          orderItemId: nextItemId++,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: data.unitPrices.get(item.productId)!,
          productName: data.productNames.get(item.productId)!,
        })),
        payments: [],
      };
      orders.set(row.orderId, row);
      return row;
    },
    updateOrder: async (orderId, data, _oldItems) => {
      const order = orders.get(orderId);
      if (!order) throw new Error("not found");
      order.customerId = data.customerId;
      order.notes = data.notes;
      order.items = data.items.map((item) => ({
        orderItemId: nextItemId++,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: data.unitPrices.get(item.productId)!,
        productName: data.productNames.get(item.productId)!,
      }));
      return { ...order, items: [...order.items] };
    },
    decrementStock: async (items) => {
      for (const item of items) products.get(item.productId)!.stockQuantity -= item.quantity;
    },
    incrementStock: async (items) => {
      for (const item of items) products.get(item.productId)!.stockQuantity += item.quantity;
    },
    runTransaction: async (fn) => fn(db),
  };

  return { db, products, orders };
}

async function placeOrder(db: OrderAdapter, products: Map<number, FakeProduct>, quantity: number) {
  products.set(1, { productId: 1, productName: "Roti Chani", stockQuantity: 10, unitPrice: 20 });
  const order = await createOrder(db, {
    customerId: 1,
    notes: null,
    items: [{ productId: 1, quantity }],
  });
  return order;
}

async function deliver(db: OrderAdapter, orderId: number) {
  await transitionOrderStatus(db, orderId, "PROCESSING");
  await transitionOrderStatus(db, orderId, "SHIPPED");
  return transitionOrderStatus(db, orderId, "DELIVERED");
}

function stockOf(products: Map<number, FakeProduct>) {
  return products.get(1)!.stockQuantity;
}

describe("fulfillment", () => {
  it("creating an order does not consume stock", async () => {
    const { db, products } = makeFakeDb();
    const order = await placeOrder(db, products, 3);
    expect(order.status).toBe("PENDING");
    expect(stockOf(products)).toBe(10);
  });

  it("delivering consumes stock; reverting to cancelled restores it", async () => {
    const { db, products } = makeFakeDb();
    const order = await placeOrder(db, products, 3);

    await deliver(db, order.orderId);
    expect(stockOf(products)).toBe(7); // 10 - 3 on delivered

    await transitionOrderStatus(db, order.orderId, "CANCELLED"); // delivered -> cancelled
    expect(stockOf(products)).toBe(10); // restored
  });

  it("rejects delivering with insufficient stock and mutates nothing", async () => {
    const { db, products } = makeFakeDb();
    const order = await placeOrder(db, products, 12);
    await deliver(db, order.orderId).then(
      () => false,
      (err) => {
        const e = err as { code?: string; status?: number };
        expect(e.code).toBe("INSUFFICIENT_STOCK");
        expect(e.status).toBe(409);
        return true;
      },
    );
    expect(stockOf(products)).toBe(10); // no decrement
    expect((await db.getOrder(order.orderId))!.status).toBe("SHIPPED"); // not moved to delivered
  });

  it("rejects an illegal transition with a conflict", async () => {
    const { db, products } = makeFakeDb();
    const order = await placeOrder(db, products, 1);
    const err = await transitionOrderStatus(db, order.orderId, "DELIVERED").then(
      () => null,
      (e: { code?: string; status?: number }) => e,
    );
    expect(err?.code).toBe("CONFLICT");
    expect(err?.status).toBe(409);
  });

  it("is a no-op transitioning to the current status", async () => {
    const { db, products } = makeFakeDb();
    const order = await placeOrder(db, products, 1);
    const status = (await transitionOrderStatus(db, order.orderId, "PENDING" as OrderStatus))!.status;
    expect(status).toBe("PENDING");
  });

  it("editing a pending order does not touch stock", async () => {
    const { db, products } = makeFakeDb();
    const order = await placeOrder(db, products, 3);
    await editOrder(db, order.orderId, {
      customerId: 1,
      notes: null,
      items: [{ productId: 1, quantity: 5 }],
    });
    expect(stockOf(products)).toBe(10);
    const updated = await db.getOrder(order.orderId);
    expect(updated?.items[0]?.quantity).toBe(5);
  });

  it("editing a delivered order restores old stock then deducts the new lines", async () => {
    const { db, products } = makeFakeDb();
    const order = await placeOrder(db, products, 3);
    await deliver(db, order.orderId);
    expect(stockOf(products)).toBe(7);

    await editOrder(db, order.orderId, {
      customerId: 1,
      notes: null,
      items: [{ productId: 1, quantity: 1 }],
    });
    expect(stockOf(products)).toBe(9); // 7 + 3 - 1
  });

  it("rejects editing a delivered order when new lines exceed available stock", async () => {
    const { db, products } = makeFakeDb();
    const order = await placeOrder(db, products, 3);
    await deliver(db, order.orderId); // stock 7
    const err = await editOrder(db, order.orderId, {
      customerId: 1,
      notes: null,
      items: [{ productId: 1, quantity: 20 }],
    }).then(
      () => null,
      (e: { code?: string; status?: number }) => e,
    );
    expect(err?.code).toBe("INSUFFICIENT_STOCK");
    expect(stockOf(products)).toBe(7); // no mutation on failed check
  });
});
