import { Router, type Request } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { asyncHandler } from "../../utils/async.js";
import { errors } from "../../utils/http.js";
import { logActivity } from "../../utils/activityLog.js";
import { env } from "../../config/env.js";

// Where uploaded invoice PDFs live. Override with INVOICES_DIR if needed.
// On Railway, set INVOICES_DIR to an absolute path backed by a persistent
// volume (the container filesystem is ephemeral and resets on redeploy).
export const INVOICES_DIR = path.resolve(env.INVOICES_DIR ?? path.join(process.cwd(), "storage", "invoices"));

const MAX_PDF_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES },
});

const router = Router();

// POST /api/invoices — store a generated invoice PDF, return its public path.
// The file is served from /files/invoices (no auth) so the customer can open
// the link sent through WhatsApp; the name contains random bytes so stored
// invoices are not guessable.
router.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req: Request, res) => {
    const file = req.file;
    if (!file) throw errors.badRequest("No PDF file uploaded");
    if (!file.buffer.subarray(0, 4).toString("latin1").startsWith("%PDF")) {
      throw errors.badRequest("Uploaded file is not a PDF");
    }

    fs.mkdirSync(INVOICES_DIR, { recursive: true });
    const name = `inv-${Date.now()}-${randomBytes(4).toString("hex")}.pdf`;
    fs.writeFileSync(path.join(INVOICES_DIR, name), file.buffer);

    const orderId = req.body?.orderId ? Number(req.body.orderId) : undefined;
    await logActivity({
      entityType: "order",
      entityId: orderId ?? 0,
      action: "invoice_shared",
      description: `Invoice PDF ${name} uploaded${orderId ? ` for Order #${orderId}` : ""}`,
    });

    res.status(201).json({ data: { path: `/files/invoices/${name}` } });
  }),
);

export default router;
