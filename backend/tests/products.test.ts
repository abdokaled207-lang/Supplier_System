import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { signToken } from "../src/middleware/auth";
import { prisma } from "../src/db/prisma";

vi.mock("../src/db/prisma", () => ({
  prisma: {
    product: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  },
}));

const app = createApp();
const token = signToken({ id: 1, email: "admin@roti.local", role: "ADMIN" });

const product = { productId: 1, productName: "Roti Chani", unitPrice: "4.00", stockQuantity: 10, createdAt: "2026-09-01T00:00:00.000Z" };

function authed(method: "get" | "post" | "put" | "delete", path: string) {
  return (request(app)[method](path) as request.Test).set("Authorization", `Bearer ${token}`);
}

describe("products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

it("lists products with a pagination envelope", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([product] as never);
    vi.mocked(prisma.product.count).mockResolvedValue(1);

    const res = await authed("get", "/api/products");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([product]);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 100 }),
    );
  });

  it("creates a product", async () => {
    vi.mocked(prisma.product.create).mockResolvedValue(product as never);

    const res = await authed("post", "/api/products").send({ productName: "Roti Chani", unitPrice: "4.00" });
    expect(res.status).toBe(201);
    expect(res.body.data.productId).toBe(1);
  });

  it("rejects a negative price and empty name with 400", async () => {
    const res = await authed("post", "/api/products").send({ productName: "", unitPrice: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing product", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

    const res = await authed("get", "/api/products/999");
    expect(res.status).toBe(404);
  });

  it("updates a product", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ productId: 1, productName: "Roti Chani", unitPrice: "4.00", imageUrl: "" } as never);
    vi.mocked(prisma.product.update).mockResolvedValue({ ...product, unitPrice: "5.00" } as never);

    const res = await authed("put", "/api/products/1").send({ unitPrice: "5.00" });
    expect(res.status).toBe(200);
    expect(res.body.data.unitPrice).toBe("5.00");
  });

  it("deletes a product via soft delete (204)", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ productId: 1, productName: "Roti Chani" } as never);
    vi.mocked(prisma.product.update).mockResolvedValue(product as never);

    const res = await authed("delete", "/api/products/1");
    expect(res.status).toBe(204);
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { productId: 1 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("returns 404 when deleting a missing product", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

    const res = await authed("delete", "/api/products/999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
