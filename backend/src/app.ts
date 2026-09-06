import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes";
import healthRoutes from "./modules/health/health.routes";
import customersRoutes from "./modules/customers/customers.routes";
import productsRoutes from "./modules/products/products.routes";
import ordersRoutes from "./modules/orders/orders.routes";
import paymentsRoutes from "./modules/payments/payments.routes";
import stockReceiptsRoutes from "./modules/stockReceipts/stockReceipts.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import searchRoutes from "./modules/search/search.routes";
import activityLogsRoutes from "./modules/activityLogs/activityLogs.routes";
import { requireAuth } from "./middleware/auth";
import { errorHandler } from "./middleware/error";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/health", healthRoutes);

  // Everything below requires a valid JWT.
  app.use("/api", requireAuth);
  app.use("/api/customers", customersRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/stock-receipts", stockReceiptsRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/activity-logs", activityLogsRoutes);

  app.use(errorHandler);

  return app;
}
