import type { OrderStatus } from "@prisma/client";
import { errors } from "../utils/http";
import type { Money } from "../utils/money";
import { assertTransition } from "./orderStatus";

// Deep module: the order-intake and status-transition flows. A caller supplies a
// small DB adapter (a seam). The module never creates the DB itself — production
// injects the Prisma-backed adapter, tests inject an in-memory fake. All the hard
// rules (price snapshot, stock-on-delivery, transition legality) hide behind a
// two-function interface.

export interface StockLine {
  productId: number;
  quantity: number;
}

export interface OrderItemRow {
  orderItemId: number;
  productId: number;
  quantity: number;
  unitPrice: Money;
  productName: string;
  product?: unknown;
}

export interface PaymentRow {
  paymentId: number;
  amount: Money;
}

export interface OrderRow {
  orderId: number;
  customerId: number;
  status: OrderStatus;
  notes: string | null;
  items: OrderItemRow[];
  payments: PaymentRow[];
  customer?: unknown;
}

export interface ProductRow {
  productId: number;
  productName: string;
  stockQuantity: number;
  unitPrice: Money;
}

export interface CustomerRow {
  customerId: number;
}

// Public input — what a caller hands to the facade.
export interface CreateOrderInput {
  customerId: number;
  orderDate?: string;
  expectedDeliveryAt?: string;
  notes?: string | null;
  items: StockLine[];
}

// Adapter-facing input — the facade resolves prices and names before delegating.
export interface CreateOrderData {
  customerId: number;
  orderDate?: string;
  expectedDeliveryAt?: string | null;
  notes: string | null;
  items: StockLine[];
  unitPrices: Map<number, Money>;
  productNames: Map<number, string>;
}

// Input for editing an existing order.
export interface EditOrderInput {
  customerId: number;
  orderDate?: string;
  expectedDeliveryAt?: string | null;
  notes?: string | null;
  items: StockLine[];
}

// The small interface (seam) the module needs. Implementations: the Prisma-backed
// adapter (db/orderAdapter.ts) and an in-memory fake (tests/fulfillment.test.ts).
export interface OrderAdapter {
  getCustomer(customerId: number): Promise<CustomerRow | null>;
  getProduct(productId: number): Promise<ProductRow | null>;
  getOrder(orderId: number): Promise<OrderRow | null>;
  setOrderStatus(orderId: number, status: OrderStatus): Promise<OrderRow>;
  createOrder(data: CreateOrderData): Promise<OrderRow>;
  updateOrder(orderId: number, data: CreateOrderData, oldItems: OrderItemRow[]): Promise<OrderRow>;
  decrementStock(items: StockLine[]): Promise<void>;
  incrementStock(items: StockLine[]): Promise<void>;
  runTransaction<T>(fn: (tx: OrderAdapter) => Promise<T>): Promise<T>;
}

async function assertStockAvailable(db: OrderAdapter, items: StockLine[]): Promise<void> {
  const short: { productId: number; name: string; requested: number; available: number }[] = [];
  for (const item of items) {
    const product = await db.getProduct(item.productId);
    if (!product) throw errors.notFound(`Product ${item.productId} not found`);
    if (product.stockQuantity < item.quantity) {
      short.push({
        productId: item.productId,
        name: product.productName,
        requested: item.quantity,
        available: product.stockQuantity,
      });
    }
  }
  if (short.length) throw errors.insufficientStock("Insufficient stock for one or more items", short);
}

// Create an order, snapshotting each product's price and name at order time.
// Stock is NOT decremented here — it moves only on 'delivered'.
export async function createOrder(db: OrderAdapter, input: CreateOrderInput): Promise<OrderRow> {
  const customer = await db.getCustomer(input.customerId);
  if (!customer) throw errors.notFound("Customer not found");

  const unitPrices = new Map<number, Money>();
  const productNames = new Map<number, string>();
  for (const item of input.items) {
    const product = await db.getProduct(item.productId);
    if (!product) throw errors.notFound(`Product ${item.productId} not found`);
    unitPrices.set(item.productId, product.unitPrice);
    productNames.set(item.productId, product.productName);
  }

  return db.createOrder({ customerId: input.customerId, orderDate: input.orderDate, expectedDeliveryAt: input.expectedDeliveryAt, notes: input.notes ?? null, items: input.items, unitPrices, productNames });
}

// Move an order to a new status, applying the stock rules:
//   shipped -> delivered  : stock consumed (after a pre-flight availability check)
//   delivered -> anything : stock restored
export function transitionOrderStatus(db: OrderAdapter, orderId: number, to: OrderStatus): Promise<OrderRow> {
  return db.runTransaction(async (tx) => {
    const existing = await tx.getOrder(orderId);
    if (!existing) throw errors.notFound("Order not found");

    assertTransition(existing.status, to);
    if (existing.status === to) return existing;

    const items: StockLine[] = existing.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));

    if (to === "DELIVERED") {
      await assertStockAvailable(tx, items);
      await tx.decrementStock(items);
    } else if (existing.status === "DELIVERED") {
      await tx.incrementStock(items);
    }

    return tx.setOrderStatus(orderId, to);
  });
}

// Edit an existing order: change customer, line items, dates, notes.
// Stock is adjusted for non-terminal orders (pending/processing/shipped).
// For delivered/cancelled orders, stock is NOT re-adjusted on edit
// (delivery/cancellation already consumed/restored stock).
export async function editOrder(
  db: OrderAdapter,
  orderId: number,
  input: EditOrderInput,
): Promise<OrderRow> {
  return db.runTransaction(async (tx) => {
    const existing = await tx.getOrder(orderId);
    if (!existing) throw errors.notFound("Order not found");

    const customer = await tx.getCustomer(input.customerId);
    if (!customer) throw errors.notFound("Customer not found");

    const unitPrices = new Map<number, Money>();
    const productNames = new Map<number, string>();
    for (const item of input.items) {
      const product = await tx.getProduct(item.productId);
      if (!product) throw errors.notFound(`Product ${item.productId} not found`);
      unitPrices.set(item.productId, product.unitPrice);
      productNames.set(item.productId, product.productName);
    }

    // Stock is only consumed while status is DELIVERED. Editing a delivered
    // order applies the net quantity delta so a failed availability check
    // mutates nothing (and pending/shipped orders never held stock).
    if (existing.status === "DELIVERED") {
      const net = new Map<number, number>();
      for (const i of existing.items) {
        net.set(i.productId, (net.get(i.productId) ?? 0) - i.quantity);
      }
      for (const i of input.items) {
        net.set(i.productId, (net.get(i.productId) ?? 0) + i.quantity);
      }
      const extra: StockLine[] = [];
      const returned: StockLine[] = [];
      for (const [productId, delta] of net) {
        if (delta > 0) extra.push({ productId, quantity: delta });
        else if (delta < 0) returned.push({ productId, quantity: -delta });
      }
      if (extra.length) await assertStockAvailable(tx, extra);
      if (returned.length) await tx.incrementStock(returned);
      if (extra.length) await tx.decrementStock(extra);
    }

    return tx.updateOrder(orderId, {
      customerId: input.customerId,
      orderDate: input.orderDate,
      expectedDeliveryAt: input.expectedDeliveryAt,
      notes: input.notes ?? null,
      items: input.items,
      unitPrices,
      productNames,
    }, existing.items);
  });
}
