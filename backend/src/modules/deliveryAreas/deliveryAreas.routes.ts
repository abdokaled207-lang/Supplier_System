import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { requireRole } from "../../middleware/auth";
import { createArea, deleteArea, listAreas, renameArea, reorderAreas } from "./deliveryAreas.service";

const router = Router();

// Reading the list is allowed for everyone (the customer form uses it);
// modifying it is admin-only.
router.get("/", asyncHandler(async (_req, res) => {
  res.json({ data: await listAreas() });
}));

router.use(requireRole("ADMIN"));

const createSchema = z.object({ name: z.string().min(1).max(150) });
const paramsSchema = z.object({ id: z.coerce.number().int().positive() });
const reorderSchema = z.object({ ids: z.array(z.coerce.number().int().positive()).min(1) });

// POST /api/delivery-areas
router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const area = await createArea((req.body as z.infer<typeof createSchema>).name.trim());
    res.status(201).json({ data: area });
  }),
);

// PUT /api/delivery-areas/order — save a new ordering (ids in display order).
// Must be declared before /:id so "order" is not parsed as an id.
router.put(
  "/order",
  validate(reorderSchema),
  asyncHandler(async (req, res) => {
    res.json({ data: await reorderAreas((req.body as z.infer<typeof reorderSchema>).ids) });
  }),
);

// PUT /api/delivery-areas/:id
router.put(
  "/:id",
  validate(paramsSchema, "params"),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const area = await renameArea(Number(req.params.id), (req.body as z.infer<typeof createSchema>).name.trim());
    res.json({ data: area });
  }),
);

// DELETE /api/delivery-areas/:id
router.delete(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    await deleteArea(Number(req.params.id));
    res.status(204).send();
  }),
);

export default router;
