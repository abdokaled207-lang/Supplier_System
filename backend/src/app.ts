import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes.js";
import healthRoutes from "./modules/health/health.routes.js";
import customersRoutes from "./modules/customers/customers.routes.js";
import productsRoutes from "./modules/products/products.routes.js";
import ordersRoutes from "./modules/orders/orders.routes.js";
import paymentsRoutes from "./modules/payments/payments.routes.js";
import stockReceiptsRoutes from "./modules/stockReceipts/stockReceipts.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import activityLogsRoutes from "./modules/activityLogs/activityLogs.routes.js";
import invoicesRoutes, { INVOICES_DIR } from "./modules/invoices/invoices.routes.js";
import imageProxyRoutes from "./modules/images/images.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { env } from "./config/env.js";

export function createApp() {
  const app = express();

  // Restrict cross-origin access to an explicit allowlist in production; fall
  // back to permissive CORS only for local development.
  const allowedOrigins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
    : [];
  app.use(
    cors({
      origin(origin, callback) {
        if (env.NODE_ENV !== "production" || !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
    }),
  );
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Stored invoice PDFs are public by link (unpredictable names); mounted
  // before the auth gate so customers can open links shared via WhatsApp.
  app.use("/files/invoices", express.static(INVOICES_DIR));

  // Same-origin image proxy so invoice logo/signature render into the PDF.
  app.use("/proxy-image", imageProxyRoutes);

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
  app.use("/api/invoices", invoicesRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/settings", settingsRoutes);

  app.use(errorHandler);

  return app;
}
