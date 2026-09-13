import dotenv from "dotenv";
import { z } from "zod";

const isTest = process.env.NODE_ENV === "test";

// Load .env once. In tests env is injected directly.
dotenv.config({ path: isTest ? undefined : ".env" });

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().optional(),
  INVOICES_DIR: z.string().optional(),
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables. Check your .env file.");
}

// A JWT secret that ships in the repo or any obvious default must never be
// accepted in production — otherwise anyone can forge admin tokens.
const WEAK_SECRETS = new Set([
  "dev-secret-change-me",
  "change-this-to-a-long-random-string",
  "test-secret-for-vitest",
  "secret",
  "changeme",
  "password",
]);

if (parsed.data.NODE_ENV === "production") {
  const weak = WEAK_SECRETS.has(parsed.data.JWT_SECRET) || parsed.data.JWT_SECRET.length < 32;
  if (weak) {
    throw new Error(
      "JWT_SECRET is too weak for production. Set a random secret of at least 32 characters.",
    );
  }
  // Without an allowlist the CORS middleware would accept every origin in
  // production — fail fast instead of silently running open.
  if (!parsed.data.CORS_ORIGIN?.trim()) {
    throw new Error(
      "CORS_ORIGIN is required in production. Set it to your frontend origin(s), e.g. CORS_ORIGIN=https://your-app.vercel.app",
    );
  }
} else if (WEAK_SECRETS.has(parsed.data.JWT_SECRET)) {
  console.warn("[env] JWT_SECRET is a known default — rotate it before deploying to production.");
}

export const env = parsed.data;
