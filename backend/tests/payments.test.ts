import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { signToken } from "../src/middleware/auth";
import { prisma } from "../src/db/prisma";

vi.mock("../src/db/prisma", () => ({
  prisma: {
    order: { findUnique: vi.fn() },
    payment: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
  },
}));

const app = createApp();
const token = signToken({ id: 1, email: "admin@roti.local", role: "ADMIN" });

const order = {
  orderId: 1,
  items: [{ orderItemId: 1, productId: 1, quantity: 2, unitPrice: "10.00" }],
};

const payment = {
  paymentId: 7,
  orderId: 1,
  amount: "20.00",
  paymentStatus: "PAID",
  paymentType: "CASH",
  paymentDate: "2026-09-01T00:00:00.000Z",
  notes: null,
};

function authed(method: "get" | "post" | "delete", path: string) {
  return (request(app)[method](path) as request.Test).set("Authorization", `Bearer ${token}`);
}

describe("payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a payment that fully covers the order -> PAID", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(order as never);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: null } } as never);
    vi.mocked(prisma.payment.create).mockResolvedValue(payment as never);

    const res = await authed("post", "/api/payments").send({ orderId: 1, amount: 20, paymentType: "cash" });
    expect(res.status).toBe(201);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: "PAID", paymentType: "CASH" }),
      }),
    );
  });

  it("creates a partial payment -> PARTIAL", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(order as never);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: "5.00" } } as never);
    vi.mocked(prisma.payment.create).mockResolvedValue({ ...payment, amount: "5.00", paymentStatus: "PARTIAL" } as never);

    const res = await authed("post", "/api/payments").send({ orderId: 1, amount: 5, paymentType: "bank_transfer" });
    expect(res.status).toBe(201);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: "PARTIAL", paymentType: "BANK_TRANSFER" }),
      }),
    );
  });

  it("returns 404 when the order does not exist", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    const res = await authed("post", "/api/payments").send({ orderId: 999, amount: 10, paymentType: "cash" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid payment type with 400", async () => {
    const res = await authed("post", "/api/payments").send({ orderId: 1, amount: 10, paymentType: "bitcoin" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lists payments for an order", async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([payment] as never);

    const res = await authed("get", "/api/payments?orderId=1");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([payment]);
    expect(prisma.payment.findMany).toHaveBeenCalledWith({ where: { orderId: 1, deletedAt: null }, orderBy: { paymentId: "asc" } });
  });

  it("deletes a payment via soft delete (204); missing -> 404", async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(payment as never);
    vi.mocked(prisma.payment.update).mockResolvedValue(payment as never);

    const ok = await authed("delete", "/api/payments/7");
    expect(ok.status).toBe(204);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { paymentId: 7 },
      data: { deletedAt: expect.any(Date) },
    });

    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);
    const missing = await authed("delete", "/api/payments/999");
    expect(missing.status).toBe(404);
  });
});
