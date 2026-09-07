import { describe, expect, it, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../src/app";
import { signToken } from "../src/middleware/auth";
import { prisma } from "../src/db/prisma";

vi.mock("../src/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

const app = createApp();

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs in with valid credentials and returns token + user", async () => {
    const passwordHash = await bcrypt.hash("Admin123!", 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 1,
      email: "admin@roti.local",
      passwordHash,
      role: "ADMIN",
    } as never);

    const res = await request(app).post("/api/auth/login").send({ email: "admin@roti.local", password: "Admin123!" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toEqual({ id: 1, email: "admin@roti.local", role: "admin" });
  });

  it("rejects an invalid password", async () => {
    const passwordHash = await bcrypt.hash("Admin123!", 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 1,
      email: "admin@roti.local",
      passwordHash,
      role: "ADMIN",
    } as never);

    const res = await request(app).post("/api/auth/login").send({ email: "admin@roti.local", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an unknown email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request(app).post("/api/auth/login").send({ email: "nobody@roti.local", password: "Admin123!" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a malformed email with 400 VALIDATION_ERROR and no DB call", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("GET /api/auth/me returns the user from a valid token", async () => {
    const validToken = signToken({ id: 1, email: "admin@roti.local", role: "ADMIN" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: 1, email: "admin@roti.local", role: "admin" });
  });

  it("GET /api/auth/me requires a valid token", async () => {
    const missing = await request(app).get("/api/auth/me");
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe("UNAUTHORIZED");

    const bad = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe("UNAUTHORIZED");
  });
});