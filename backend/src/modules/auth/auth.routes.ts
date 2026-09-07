import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { login, updateMe } from "./auth.service";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Please try again in 15 minutes." } },
});

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateMeSchema = z.object({
  email: z.string().email().optional(),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters").optional(),
});

// POST /api/auth/login
router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const result = await login(loginSchema.parse(req.body));
    res.json(result);
  }),
);

// GET /api/auth/me
// Protected (unlike /login): returns the identity from the verified token.
router.get("/me", requireAuth, (req, res) => {
  const u = req.user!;
  res.json({ user: { id: u.id, email: u.email, role: u.role === "ADMIN" ? "admin" : "employee" } });
});

// PUT /api/auth/me — update email or change password
router.put(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = updateMeSchema.parse(req.body);
    const result = await updateMe(req.user!.id, body);
    res.json(result);
  }),
);

export default router;
