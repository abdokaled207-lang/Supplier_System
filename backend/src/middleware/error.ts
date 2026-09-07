import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { AppError } from "../utils/http";
import { UnderTotalError } from "../domain/orderMoney";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof UnderTotalError) {
    res.status(409).json({ error: { code: "PAID_EXCEEDS_TOTAL", message: error.message, details: { newTotal: error.newTotal, paid: error.paid } } });
    return;
  }
  if (error instanceof MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "File is too large (max 10 MB)" : "File upload failed";
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message } });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Validation failed", details: error.flatten() } });
    return;
  }
  // Prisma P2002 unique constraint
  if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
    res.status(409).json({ error: { code: "CONFLICT", message: "A record with that value already exists" } });
    return;
  }
  console.error(error);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
}
