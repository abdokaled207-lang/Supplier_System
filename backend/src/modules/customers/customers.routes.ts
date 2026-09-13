import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async.js";
import { validate } from "../../middleware/validate.js";
import { requireAdmin } from "../../middleware/auth.js";
import { parsePagination, paginated } from "../../utils/pagination.js";
import {
  createCustomer,
  getCustomerProfile,
  listCustomers,
  restoreCustomer,
  softDeleteCustomer,
  updateCustomer,
} from "./customers.service.js";

const router = Router();

const createSchema = z.object({
  fullName: z.string().min(1).max(150),
  phone: z.string().min(1).max(20),
  gpsLink: z
    .string()
    .nullable()
    .optional()
    .refine((val) => val === null || val === undefined || val === "" || val.startsWith("http"), {
      message: "GPS link must start with http",
    }),
  address: z.string().nullable().optional(),
  area: z.string().max(150).nullable().optional(),
});

const updateSchema = createSchema.partial();

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

// GET /api/customers?page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = parsePagination(req.query);
    const { customers, total } = await listCustomers(page);
    res.json(paginated(customers, total, page.page, page.pageSize));
  }),
);

// GET /api/customers/:id — customer profile with full order history + outstanding balance
router.get(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const customer = await getCustomerProfile(Number(req.params.id));
    res.json({ data: customer });
  }),
);

// POST /api/customers
router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const customer = await createCustomer(req.body as z.infer<typeof createSchema>);
    res.status(201).json({ data: customer });
  }),
);

// PUT /api/customers/:id
router.put(
  "/:id",
  requireAdmin,
  validate(paramsSchema, "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const customer = await updateCustomer(Number(req.params.id), req.body as z.infer<typeof updateSchema>);
    res.json({ data: customer });
  }),
);

// DELETE /api/customers/:id — soft delete
router.delete(
  "/:id",
  requireAdmin,
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    await softDeleteCustomer(Number(req.params.id));
    res.status(204).send();
  }),
);

// POST /api/customers/:id/restore — restore soft-deleted customer
router.post(
  "/:id/restore",
  requireAdmin,
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const customer = await restoreCustomer(Number(req.params.id));
    res.json({ data: customer });
  }),
);

export default router;
