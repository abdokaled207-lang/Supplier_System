import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async.js";
import { validate } from "../../middleware/validate.js";
import { requireAdmin } from "../../middleware/auth.js";
import { getSettings, updateSettings, SETTING_KEYS } from "./settings.service.js";

const router = Router();

// Every field is optional; only provided keys are written. Values are stored as
// strings (lowStockThreshold is a numeric string) to match the frontend shape.
const updateSchema = z.object({
  companyName: z.string().max(200).optional(),
  companyOwner: z.string().max(200).optional(),
  companyAddress: z.string().max(2000).optional(),
  companyCity: z.string().max(150).optional(),
  companyPhone: z.string().max(50).optional(),
  companyEmail: z.string().max(200).optional(),
  bankName: z.string().max(200).optional(),
  bankAccountName: z.string().max(200).optional(),
  bankAccountNumber: z.string().max(100).optional(),
  lowStockThreshold: z.coerce.number().int().min(1).max(9999).optional(),
  logoUrl: z.string().max(1000).optional(),
  signatureUrl: z.string().max(1000).optional(),
});

// GET /api/settings — any authenticated user (invoices/pages need it).
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ data: await getSettings() });
  }),
);

// PUT /api/settings — admin only.
router.put(
  "/",
  requireAdmin,
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<Record<(typeof SETTING_KEYS)[number], string | number>>;
    const input = Object.fromEntries(
      Object.entries(body).map(([k, v]) => [k, String(v)]),
    );
    res.json({ data: await updateSettings(input) });
  }),
);

export default router;