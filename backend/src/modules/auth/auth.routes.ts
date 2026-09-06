import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/async";
import { errors } from "../../utils/http";
import { signToken, requireAuth } from "../../middleware/auth";

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
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw errors.unauthorized("Invalid email or password");
    }
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    const wireRole = user.role === "ADMIN" ? "admin" : "employee";
    res.json({ token, user: { id: user.id, email: user.email, role: wireRole } });
  }),
);

// GET /api/auth/me
// Protected (unlike /login): returns the identity from the verified token.
router.get("/me", requireAuth, (req, res) => {
  const u = req.user!;
  const wireRole = u.role === "ADMIN" ? "admin" : "employee";
  res.json({ user: { id: u.id, email: u.email, role: wireRole } });
});

// PUT /api/auth/me — update email or change password
router.put(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = updateMeSchema.parse(req.body);
    const u = req.user!;

    const user = await prisma.user.findUnique({ where: { id: u.id } });
    if (!user) throw errors.unauthorized("User not found");

    if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
      throw errors.unauthorized("Current password is incorrect");
    }

    const updates: { email?: string; passwordHash?: string } = {};
    if (body.email !== undefined && body.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing && existing.id !== user.id) throw errors.conflict("Email already in use");
      updates.email = body.email;
    }

    if (body.newPassword !== undefined) {
      updates.passwordHash = await bcrypt.hash(body.newPassword, 10);
    }

    const updated = await prisma.user.update({ where: { id: u.id }, data: updates });
    const newToken = signToken({ id: updated.id, email: updated.email, role: updated.role });
    const wireRole = updated.role === "ADMIN" ? "admin" : "employee";
    res.json({ token: newToken, user: { id: updated.id, email: updated.email, role: wireRole } });
  }),
);

export default router;
