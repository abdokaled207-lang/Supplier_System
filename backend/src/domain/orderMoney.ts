import type { PaymentStatus } from "@prisma/client";
import { fromCents, toCents, type Money } from "../utils/money.js";

// Deep module: the "how much is this order worth / how much is paid" rules live
// here, hidden behind a tiny interface. All totals are computed in integer cents
// and returned as fixed 2-decimal strings — no float math leaks into routes.

export interface ItemLine {
  quantity: number;
  unitPrice: Money;
}

export interface PaymentLine {
  amount: Money;
}

export interface OrderItemView extends ItemLine {
  orderItemId: number;
  productId: number;
  product?: unknown;
}

export interface PaymentView extends PaymentLine {
  paymentId: number;
}

export interface MoneyTotals {
  total: string;
  paid: string;
  balance: string;
}

export function orderTotals(items: ItemLine[], payments: PaymentLine[] = []): MoneyTotals {
  const totalCents = items.reduce((sum, item) => sum + item.quantity * toCents(item.unitPrice), 0);
  const paidCents = payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
  return {
    total: fromCents(totalCents),
    paid: fromCents(paidCents),
    balance: fromCents(totalCents - paidCents),
  };
}

// Decide a payment's DB status from how much of the order is now covered.
export function paymentStatusFor(totalCents: number, paidCents: number): PaymentStatus {
  if (paidCents >= totalCents && totalCents > 0) return "PAID";
  if (paidCents > 0) return "PARTIAL";
  return "UNPAID";
}

// Throw if a proposed new total is below the already-paid amount. Used on edit
// to surface the conflict through the shared error envelope instead of leaking
// float math into routes. If `acknowledgeUnderTotal` is true, the caller has
// accepted the underflow (admin override).
export function assertTotalCoversPaid(
  newItemLines: { quantity: number; unitPrice: Money }[],
  paidSoFar: Money[],
  acknowledgeUnderTotal: boolean,
): { newTotal: string; paid: string } {
  let newTotalCents = 0;
  for (const it of newItemLines) {
    newTotalCents += it.quantity * toCents(it.unitPrice);
  }
  let paidCents = 0;
  for (const amount of paidSoFar) {
    paidCents += toCents(amount);
  }
  if (newTotalCents < paidCents && !acknowledgeUnderTotal) {
    throw new UnderTotalError(newTotalCents, paidCents);
  }
  return { newTotal: fromCents(newTotalCents), paid: fromCents(paidCents) };
}

export class UnderTotalError extends Error {
  public readonly newTotal: string;
  public readonly paid: string;
  constructor(newTotalCents: number, paidCents: number) {
    super(
      `New total (RM ${fromCents(newTotalCents)}) is below the already-paid amount (RM ${fromCents(paidCents)}). Confirm to proceed.`,
    );
    this.name = "UnderTotalError";
    this.newTotal = fromCents(newTotalCents);
    this.paid = fromCents(paidCents);
  }
}

// Serialize an order row (Plus its items/payments) into the API view: adds each
// item's `subtotal` and the order-level `total` / `paid` / `balance`.
export function decorateOrder<Base extends { items: OrderItemView[]; payments?: PaymentView[] }>(order: Base) {
  const items = order.items.map((item) => ({
    ...item,
    subtotal: fromCents(item.quantity * toCents(item.unitPrice)),
  }));
  const totals = orderTotals(order.items, order.payments ?? []);
  return { ...order, items, ...totals };
}
