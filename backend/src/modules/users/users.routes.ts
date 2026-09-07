import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { requireRole } from "../../middleware/auth";
import {
  createUser,
  deactivateUser,
  listUsers,
  resetUserPassword,
  updateUserRole,
} from "./users.service";

const router = Router();

// Every route here is admin-only: these endpoints control who can access and
// modify the system.
router.use(requireRole("ADMIN"));

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "employee"]),
});

const roleSchema = z.object({ role: z.enum(["admin", "employee"]) });

const resetSchema = z.object({ password: z.string().min(8) });

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

// GET /api/users
router.get("/", asyncHandler(async (_req, res) => {
  res.json({ data: await listUsers() });
}));

// POST /api/users
router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const user = await createUser(req.body as z.infer<typeof createSchema>);
    res.status(201).json({ data: user });
  }),
);

// PATCH /api/users/:id/role
router.patch(
  "/:id/role",
  validate(paramsSchema, "params"),
  validate(roleSchema),
  asyncHandler(async (req, res) => {
    const user = await updateUserRole(Number(req.params.id), (req.body as z.infer<typeof roleSchema>).role);
    res.json({ data: user });
  }),
);

// PATCH /api/users/:id/password
router.patch(
  "/:id/password",
  validate(paramsSchema, "params"),
  validate(resetSchema),
  asyncHandler(async (req, res) => {
    await resetUserPassword(Number(req.params.id), (req.body as z.infer<typeof resetSchema>).password);
    res.status(204).send();
  }),
);

// DELETE /api/users/:id — deactivate (soft delete); login is rejected for it.
router.delete(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req, res) => {
    await deactivateUser(Number(req.params.id));
    res.status(204).send();
  }),
);

export default router;
