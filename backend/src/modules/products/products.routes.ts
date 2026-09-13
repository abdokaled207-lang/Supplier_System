import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async.js";
import { validate } from "../../middleware/validate.js";
import { requireAdmin } from "../../middleware/auth.js";
import { parsePagination, paginated } from "../../utils/pagination.js";
import {
  createProduct,
  getProduct,
  getProductWithRecentOrders,
  listProducts,
  restoreProduct,
  softDeleteProduct,
  updateProduct,
} from "./products.service.js";

const router = Router();

const createSchema = z.object({
  productName: z.string().min(1).max(150),
  unitPrice: z.coerce.number().min(0),
  stockQuantity: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().max(500).optional(),
});

const updateSchema = z.object({
  productName: z.string().min(1).max(150).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  imageUrl: z.string().max(500).optional(),
});

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

// GET /api/products?page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = parsePagination(req.query);
    const { products, total } = await listProducts(page);
    res.json(paginated(products, total, page.page, page.pageSize));
  }),
);

// GET /api/products/:id/orders — product detail with recent orders
router.get(
  "/:id/orders",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const data = await getProductWithRecentOrders(Number(req.params.id));
    res.json({ data });
  }),
);

// GET /api/products/:id
router.get(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const product = await getProduct(Number(req.params.id));
    res.json({ data: product });
  }),
);

// POST /api/products
router.post(
  "/",
  requireAdmin,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const product = await createProduct(req.body as z.infer<typeof createSchema>);
    res.status(201).json({ data: product });
  }),
);

// PUT /api/products/:id
router.put(
  "/:id",
  requireAdmin,
  validate(paramsSchema, "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const product = await updateProduct(Number(req.params.id), req.body as z.infer<typeof updateSchema>);
    res.json({ data: product });
  }),
);

// DELETE /api/products/:id — soft delete
router.delete(
  "/:id",
  requireAdmin,
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    await softDeleteProduct(Number(req.params.id));
    res.status(204).send();
  }),
);

// POST /api/products/:id/restore — restore soft-deleted product
router.post(
  "/:id/restore",
  requireAdmin,
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    const product = await restoreProduct(Number(req.params.id));
    res.json({ data: product });
  }),
);

export default router;
