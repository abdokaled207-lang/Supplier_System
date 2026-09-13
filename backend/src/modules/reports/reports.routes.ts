import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { asyncHandler } from "../../utils/async.js";
import { validate } from "../../middleware/validate.js";
import { parseRangeParams } from "../../domain/reports.js";
import { buildReportsAdapter } from "../../db/reportsAdapter.js";
import { csvResponse, toCsv } from "../../utils/csv.js";

const router = Router();

function getAdapter() {
  return buildReportsAdapter(prisma);
}

// GET /api/reports/orders-by-status
router.get("/orders-by-status", asyncHandler(async (_req, res) => {
  res.json({ data: await getAdapter().ordersByStatus() });
}));

// GET /api/reports/orders-by-status.csv
router.get("/orders-by-status.csv", asyncHandler(async (_req, res) => {
  const rows = await getAdapter().ordersByStatus();
  csvResponse(res, "orders-by-status.csv", toCsv(["status", "count"], rows));
}));

// GET /api/reports/customer-balance?range=daily|weekly|monthly|custom&start=&end=
router.get("/customer-balance", asyncHandler(async (req, res) => {
  const range = parseRangeParams(req.query as Record<string, unknown>);
  res.json({ data: await getAdapter().customerBalances(range) });
}));

// GET /api/reports/customer-balance.csv
router.get("/customer-balance.csv", asyncHandler(async (req, res) => {
  const range = parseRangeParams(req.query as Record<string, unknown>);
  const rows = await getAdapter().customerBalances(range);
  csvResponse(res, "customer-balance.csv", toCsv(["customerId", "fullName", "phone", "total", "paid", "balance"], rows));
}));

// GET /api/reports/product-stock
router.get("/product-stock", asyncHandler(async (_req, res) => {
  res.json({ data: await getAdapter().productStock() });
}));

// GET /api/reports/product-stock.csv
router.get("/product-stock.csv", asyncHandler(async (_req, res) => {
  const rows = await getAdapter().productStock();
  csvResponse(res, "product-stock.csv", toCsv(["productId", "productName", "unitPrice", "stockQuantity"], rows));
}));

// GET /api/reports/best-sellers?range=daily|weekly|monthly|custom&start=&end=
router.get("/best-sellers", asyncHandler(async (req, res) => {
  const range = parseRangeParams(req.query as Record<string, unknown>);
  res.json({ data: await getAdapter().bestSellers(range) });
}));

// GET /api/reports/dashboard — aggregate stats for the dashboard (server-side)
router.get(
  "/dashboard",
  validate(
    z.object({ lowStockThreshold: z.coerce.number().int().min(0).optional() }),
    "query"
  ),
  asyncHandler(async (req, res) => {
    const lowStockThreshold = Number(req.query.lowStockThreshold ?? 0);
    res.json({ data: await getAdapter().dashboard(lowStockThreshold) });
  }),
);

// GET /api/reports/today-sales
router.get("/today-sales", asyncHandler(async (_req, res) => {
  res.json({ data: await getAdapter().todaySales() });
}));

export default router;