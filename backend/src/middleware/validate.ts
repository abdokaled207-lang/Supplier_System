import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { errors } from "../utils/http";

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return next(errors.badRequest("Validation failed", parsed.error.flatten()));
    }
    req[source] = parsed.data;
    next();
  };
}
