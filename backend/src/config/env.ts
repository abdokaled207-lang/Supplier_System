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
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables. Check your .env file.");
}

export const env = parsed.data;
