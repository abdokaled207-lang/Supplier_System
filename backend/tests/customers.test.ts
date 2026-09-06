import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { signToken } from "../src/middleware/auth";
import { prisma } from "../src/db/prisma";

vi.mock("../src/db/prisma", () => ({
  prisma: {
    customer: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  },
}));

const app = createApp();
const token = signToken({ id: 1, email: "admin@roti.local", role: "admin" });

const customer = { customerId: 1, fullName: "Ahmad", phone: "0123456789", gpsLink: null, address: null, createdAt: "2026-09-01T00:00:00.000Z" };

function authed(method: "get" | "post" | "put" | "delete", path: string) {
  return (request(app)[method](path) as request.Test).set("Authorization", `Bearer ${token}`);
}

describe("customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists customers with pagination envelope", async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([customer] as never);
    vi.mocked(prisma.customer.count).mockResolvedValue(1);

    const res = await authed("get", "/api/customers");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([customer]);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(100);
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 100 }),
    );
  });

  it("honors page and pageSize query params", async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([]);
    vi.mocked(prisma.customer.count).mockResolvedValue(50);

    const res = await authed("get", "/api/customers?page=3&pageSize=10");
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(3);
    expect(res.body.total).toBe(50);
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/customers");
    expect(res.status).toBe(401);
  });

  it("creates a customer", async () => {
    vi.mocked(prisma.customer.create).mockResolvedValue(customer as never);

    const res = await authed("post", "/api/customers").send({ fullName: "Ahmad", phone: "0123456789" });
    expect(res.status).toBe(201);
    expect(res.body.data.customerId).toBe(1);
    expect(prisma.customer.create).toHaveBeenCalledWith({ data: { fullName: "Ahmad", phone: "0123456789" } });
  });

  it("rejects missing fields with 400", async () => {
    const res = await authed("post", "/api/customers").send({ fullName: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it("fetches a customer by id", async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(customer as never);

    const res = await authed("get", "/api/customers/1");
    expect(res.status).toBe(200);
    expect(res.body.data.customerId).toBe(1);
  });

  it("returns 404 for a missing customer", async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(null);

    const res = await authed("get", "/api/customers/999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("updates a customer", async () => {
    vi.mocked(prisma.customer.update).mockResolvedValue({ ...customer, fullName: "Ahmad Ali" } as never);

    const res = await authed("put", "/api/customers/1").send({ fullName: "Ahmad Ali" });
    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe("Ahmad Ali");
  });

  it("deletes a customer (204)", async () => {
    vi.mocked(prisma.customer.delete).mockResolvedValue(customer as never);

    const res = await authed("delete", "/api/customers/1");
    expect(res.status).toBe(204);
  });

  it("returns 409 when a customer has orders (FK restrict)", async () => {
    vi.mocked(prisma.customer.delete).mockRejectedValue(new Error("FK violation"));

    const res = await authed("delete", "/api/customers/1");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });
});
