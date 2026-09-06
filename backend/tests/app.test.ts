import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";

vi.mock("../src/db/prisma", () => ({
  prisma: {
    order: { findMany: vi.fn(), count: vi.fn() },
    product: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

const app = createApp();

describe("app routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /api/health is public and reports db connected when reachable", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }]);
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "connected" });
  });

  it("GET /api/health returns 503 when the db is unreachable", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connect ECONNREFUSED"));
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "error", db: "unreachable" });
  });

  it("protected routes require a token", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("login rejects missing fields with a validation error", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});