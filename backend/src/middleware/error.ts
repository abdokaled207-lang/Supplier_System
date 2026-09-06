import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/http";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
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
