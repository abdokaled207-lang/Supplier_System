export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (msg = "Bad request", details?: unknown) => new AppError(400, "VALIDATION_ERROR", msg, details),
  unauthorized: (msg = "Unauthorized") => new AppError(401, "UNAUTHORIZED", msg),
  forbidden: (msg = "Forbidden") => new AppError(403, "FORBIDDEN", msg),
  notFound: (msg = "Not found") => new AppError(404, "NOT_FOUND", msg),
  conflict: (msg = "Conflict") => new AppError(409, "CONFLICT", msg),
  insufficientStock: (msg = "Insufficient stock", details?: unknown) =>
    new AppError(409, "INSUFFICIENT_STOCK", msg, details),
  tooManyRequests: (msg = "Too many requests") => new AppError(429, "TOO_MANY_REQUESTS", msg),
};
