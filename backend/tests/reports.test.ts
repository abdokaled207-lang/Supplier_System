import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { signToken } from "../src/middleware/auth";
import { prisma } from "../src/db/prisma";
import { toCsv } from "../src/utils/csv";

vi.mock("../src/db/prisma", () => ({
  prisma: {
    order: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    customer: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

const app = createApp();
const token = signToken({ id: 1, email: "admin@roti.local", role: "admin" });

function authed(path: string) {
  return request(app).get(path).set("Authorization", `Bearer ${token}`);
}

describe("reports CSV export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orders-by-status.csv streams CSV content", async () => {
    vi.mocked(prisma.order.groupBy).mockResolvedValue([
      { status: "DELIVERED", _count: { orderId: 2 } },
      { status: "PENDING", _count: { orderId: 1 } },
    ] as never);

    const res = await authed("/api/reports/orders-by-status.csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain('filename="orders-by-status.csv"');
    expect(res.text).toContain("status,count");
    expect(res.text).toContain("DELIVERED,2");
  });

  it("customer-balance.csv includes money columns", async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([]);
    const res = await authed("/api/reports/customer-balance.csv");
    expect(res.status).toBe(200);
    expect(res.text).toContain("customerId,fullName,phone,total,paid,balance");
  });

  it("product-stock.csv includes the header", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    const res = await authed("/api/reports/product-stock.csv");
    expect(res.status).toBe(200);
    expect(res.text).toContain("productId,productName,unitPrice,stockQuantity");
  });

  it("CSV endpoints require auth", async () => {
    const res = await request(app).get("/api/reports/customer-balance.csv");
    expect(res.status).toBe(401);
  });
});

describe("toCsv", () => {
  it("quotes fields containing commas, quotes, or newlines", () => {
    const csv = toCsv(
      ["name", "note"],
      [
        { name: "a,b", note: 'say "hi"' },
        { name: "plain", note: "multi\nline" },
      ],
    );
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain('"multi\nline"');
  });

  it("renders null as empty", () => {
    const csv = toCsv(["a", "b"], [{ a: 1, b: null }]);
    expect(csv).toContain("1,");
  });
});