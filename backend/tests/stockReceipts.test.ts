import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { signToken } from "../src/middleware/auth";
import { prisma } from "../src/db/prisma";

vi.mock("../src/db/prisma", () => ({
  prisma: {
    product: { findUnique: vi.fn(), update: vi.fn() },
    stockReceipt: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const app = createApp();
const token = signToken({ id: 1, email: "admin@roti.local", role: "ADMIN" });

const product = { productId: 1, productName: "Roti Chani", unitPrice: "4.00", stockQuantity: 10, createdAt: new Date() };
const receipt = { receiptId: 5, productId: 1, quantity: 3, receiptDate: new Date(), notes: null };

function authed(method: "get" | "post" | "delete", path: string) {
  return (request(app)[method](path) as request.Test).set("Authorization", `Bearer ${token}`);
}

// Run the route's transaction callback against the mocked tx client.
function withTx() {
  vi.mocked(prisma.$transaction).mockImplementation(
    (fn: (tx: typeof prisma) => unknown) => Promise.resolve(fn(prisma)) as never,
  );
}

describe("stock receipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists receipts including their product with a pagination envelope", async () => {
    vi.mocked(prisma.stockReceipt.findMany).mockResolvedValue([{ ...receipt, product }] as never);
    vi.mocked(prisma.stockReceipt.count).mockResolvedValue(1);

    const res = await authed("get", "/api/stock-receipts");
    expect(res.status).toBe(200);
    expect(res.body.data[0].product.productName).toBe("Roti Chani");
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
  });

  it("creates a receipt and increments stock inside a transaction", async () => {
    withTx();
    vi.mocked(prisma.product.findUnique).mockResolvedValue(product as never);
    vi.mocked(prisma.stockReceipt.create).mockResolvedValue(receipt as never);

    const res = await authed("post", "/api/stock-receipts").send({ productId: 1, quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.data.receiptId).toBe(5);
    expect(prisma.stockReceipt.create).toHaveBeenCalledWith({ data: { productId: 1, quantity: 3, notes: undefined } });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { productId: 1 },
      data: { stockQuantity: { increment: 3 } },
    });
  });

  it("returns 404 when the product does not exist", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

    const res = await authed("post", "/api/stock-receipts").send({ productId: 999, quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects zero quantity with 400", async () => {
    const res = await authed("post", "/api/stock-receipts").send({ productId: 1, quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("deleting a receipt decrements stock inside a transaction", async () => {
    withTx();
    vi.mocked(prisma.stockReceipt.findUnique).mockResolvedValue({ ...receipt, product } as never);

    const res = await authed("delete", "/api/stock-receipts/5");
    expect(res.status).toBe(204);
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { productId: 1 },
      data: { stockQuantity: { decrement: 3 } },
    });
    expect(prisma.stockReceipt.update).toHaveBeenCalledWith({
      where: { receiptId: 5 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("returns 404 when deleting a missing receipt", async () => {
    vi.mocked(prisma.stockReceipt.findUnique).mockResolvedValue(null);

    const res = await authed("delete", "/api/stock-receipts/999");
    expect(res.status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
