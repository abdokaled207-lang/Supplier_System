import { describe, expect, it } from "vitest";
import { orderTotals, paymentStatusFor, decorateOrder } from "../src/domain/orderMoney";
import { toCents } from "../src/utils/money";

describe("orderTotals", () => {
  it("sums item quantities times unit prices into cents-safe strings", () => {
    const totals = orderTotals([
      { quantity: 2, unitPrice: "10.00" },
      { quantity: 1, unitPrice: "15.50" },
    ]);
    expect(totals).toEqual({ total: "35.50", paid: "0.00", balance: "35.50" });
  });

  it("avoids float drift for repeating decimals", () => {
    const totals = orderTotals([{ quantity: 3, unitPrice: "0.10" }]);
    expect(totals.total).toBe("0.30");
  });

  it("subtracts paid from total for balance", () => {
    const totals = orderTotals([{ quantity: 2, unitPrice: "20.00" }], [{ amount: "25.00" }]);
    expect(totals).toEqual({ total: "40.00", paid: "25.00", balance: "15.00" });
  });
});

describe("paymentStatusFor", () => {
  it("is PAID when fully covered, PARTIAL when partly covered, UNPAID otherwise", () => {
    expect(paymentStatusFor(toCents("100.00"), toCents("100.00"))).toBe("PAID");
    expect(paymentStatusFor(toCents("100.00"), toCents("50.00"))).toBe("PARTIAL");
    expect(paymentStatusFor(toCents("100.00"), toCents("0"))).toBe("UNPAID");
  });
});

describe("decorateOrder", () => {
  it("adds per-item subtotal and order-level totals", () => {
    const order = {
      orderId: 1,
      items: [
        { orderItemId: 1, productId: 1, quantity: 2, unitPrice: "10.00" },
        { orderItemId: 2, productId: 2, quantity: 1, unitPrice: "5.00" },
      ],
      payments: [{ paymentId: 1, amount: "15.00" }],
    };
    const decorated = decorateOrder(order);
    expect(decorated.items[0].subtotal).toBe("20.00");
    expect(decorated.items[1].subtotal).toBe("5.00");
    expect(decorated.total).toBe("25.00");
    expect(decorated.paid).toBe("15.00");
    expect(decorated.balance).toBe("10.00");
  });
});
