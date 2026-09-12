import { describe, expect, it, vi, beforeEach } from "vitest";
import { orderDb } from "../src/db/orderAdapter";
import { prisma } from "../src/db/prisma";

vi.mock("../src/db/prisma", () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    customer: { findUnique: vi.fn() },
    product: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    orderItem: {},
    $transaction: vi.fn(),
  },
}));

// A fake transaction client whose product/order calls are distinct spies, so a
// test can prove stock mutations inside runTransaction target the tx client
// rather than the base client (the regression that broke shipped->delivered).
function makeTx() {
  const tx = {
    product: {
      update: vi.fn().mockResolvedValue({ productId: 1, stockQuantity: 8 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    order: { findUnique: vi.fn(), update: vi.fn() },
    customer: { findUnique: vi.fn() },
  };
  vi.mocked(prisma.$transaction).mockImplementation(
    ((fn: unknown) => Promise.resolve((fn as (tx: unknown) => unknown)(tx))) as never,
  );
  return tx;
}

describe("orderAdapter transactional behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("decrements stock through the transaction client inside runTransaction", async () => {
    const tx = makeTx();
    await orderDb.runTransaction(async (adapter) => {
      await adapter.decrementStock([{ productId: 1, quantity: 2 }]);
    });

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { productId: 1, stockQuantity: { gte: 2 } },
      data: { stockQuantity: { decrement: 2 } },
    });
    // The base client must not be touched for stock inside the transaction.
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });

  it("increments stock through the transaction client inside runTransaction", async () => {
    const tx = makeTx();
    await orderDb.runTransaction(async (adapter) => {
      await adapter.incrementStock([{ productId: 1, quantity: 3 }]);
    });

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { productId: 1 },
      data: { stockQuantity: { increment: 3 } },
    });
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it("increments multiple lines sequentially and only via the tx client", async () => {
    const tx = makeTx();
    await orderDb.runTransaction(async (adapter) => {
      await adapter.incrementStock([
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 4 },
      ]);
    });

    expect(tx.product.update).toHaveBeenCalledTimes(2);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });
});