import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma";
import { errors } from "../../utils/http";
import { signToken } from "../../middleware/auth";

function toWireRole(role: string) {
  return role === "ADMIN" ? "admin" : "employee";
}

export async function login(credentials: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: credentials.email } });
  if (!user || !(await bcrypt.compare(credentials.password, user.passwordHash))) {
    throw errors.unauthorized("Invalid email or password");
  }
  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return { token, user: { id: user.id, email: user.email, role: toWireRole(user.role) } };
}

export async function updateMe(
  userId: number,
  input: { email?: string; currentPassword: string; newPassword?: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.unauthorized("User not found");

  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw errors.unauthorized("Current password is incorrect");
  }

  const updates: { email?: string; passwordHash?: string } = {};
  if (input.email !== undefined && input.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing && existing.id !== user.id) throw errors.conflict("Email already in use");
    updates.email = input.email;
  }

  if (input.newPassword !== undefined) {
    updates.passwordHash = await bcrypt.hash(input.newPassword, 10);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: updates });
  const token = signToken({ id: updated.id, email: updated.email, role: updated.role });
  return { token, user: { id: updated.id, email: updated.email, role: toWireRole(updated.role) } };
}
