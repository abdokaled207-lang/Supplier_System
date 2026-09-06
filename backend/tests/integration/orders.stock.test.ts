// Integration tests for the stock rules. Requires a real, migrated MySQL DB
// (DATABASE_URL from vitest config env). Run separately:
//   npm run test:integration
import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app";

const app = createApp();
let token = "";

async function auth(): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email: "admin@roti.local", password: "Admin123!" });
  return res.body.token as string;
}

async function seedUniqueProduct(): Promise<number> {
  const name = `P${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const res = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${token}`)
    .send({ productName: name, unitPrice: 20 });
  expect(res.status).toBe(201);
  return res.body.data.productId as number;
}

async function receiveStock(productId: number, qty: number): Promise<void> {
  const res = await request(app)
    .post("/api/stock-receipts")
    .set("Authorization", `Bearer ${token}`)
    .send({ productId, quantity: qty });
  expect(res.status).toBe(201);
}

async function createOrder(customerId: number, items: { productId: number; quantity: number }[]): Promise<number> {
  const res = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId, items });
  expect(res.status).toBe(201);
  return res.body.data.orderId as number;
}

async function setStatus(orderId: number, status: string) {
  return request(app).patch(`/api/orders/${orderId}/status`).set("Authorization", `Bearer ${token}`).send({ status });
}

async function stockOf(productId: number): Promise<number> {
  const res = await request(app).get(`/api/products/${productId}`).set("Authorization", `Bearer ${token}`);
  return res.body.data.stockQuantity as number;
}

beforeAll(async () => {
  token = await auth();
});

describe("stock rules", () => {
  it("receiving stock increments the product quantity", async () => {
    const productId = await seedUniqueProduct();
    await receiveStock(productId, 50);
    expect(await stockOf(productId)).toBe(50);
  });

  it("delivering an order decrements stock; cancelling it restores it", async () => {
    const productId = await seedUniqueProduct();
    await receiveStock(productId, 30);

    const customer = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "Test Customer", phone: `55${Date.now()}` });
    const customerId = customer.body.data.customerId as number;

    const orderId = await createOrder(customerId, [{ productId, quantity: 10 }]);
    expect(await stockOf(productId)).toBe(30); // order placement does not decrement

    let res = await setStatus(orderId, "processing");
    expect(res.status).toBe(200);
    res = await setStatus(orderId, "shipped");
    expect(res.status).toBe(200);
    res = await setStatus(orderId, "delivered");
    expect(res.status).toBe(200);
    expect(await stockOf(productId)).toBe(20); // shipped -> delivered consumes 10

    res = await setStatus(orderId, "cancelled");
    expect(res.status).toBe(200);
    expect(await stockOf(productId)).toBe(30); // delivered -> cancelled restores
  });

  it("blocks delivering when stock is insufficient", async () => {
    const productId = await seedUniqueProduct();
    await receiveStock(productId, 3);

    const customer = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "Test Customer 2", phone: `77${Date.now()}` });
    const customerId = customer.body.data.customerId as number;

    const orderId = await createOrder(customerId, [{ productId, quantity: 10 }]);
    await setStatus(orderId, "processing");
    await setStatus(orderId, "shipped");

    const res = await setStatus(orderId, "delivered");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(await stockOf(productId)).toBe(3); // no mutation
  });
});
