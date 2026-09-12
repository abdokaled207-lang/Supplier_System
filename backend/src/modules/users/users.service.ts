import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma";
import { errors } from "../../utils/http";
import { toDbRole, toWireRole, type WireRole } from "../../domain/enums";

const MIN_PASSWORD_LENGTH = 8;

export async function listUsers() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { id: "asc" },
    select: { id: true, email: true, role: true, createdAt: true, deletedAt: true },
  });
  return users.map((u) => ({ id: u.id, email: u.email, role: toWireRole(u.role), createdAt: u.createdAt }));
}

export async function createUser(input: { email: string; password: string; role: WireRole }) {
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw errors.badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing && !existing.deletedAt) throw errors.conflict("Email already in use");

  const data = {
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 10),
    role: toDbRole(input.role),
  };

  const user = existing
    ? // Re-create a previously deactivated account with the new credentials.
      await prisma.user.update({ where: { id: existing.id }, data: { ...data, deletedAt: null } })
    : await prisma.user.create({ data });

  return { id: user.id, email: user.email, role: toWireRole(user.role) };
}

export async function updateUserRole(id: number, role: WireRole) {
  const user = await prisma.user.findUnique({ where: { id, deletedAt: null } });
  if (!user) throw errors.notFound("User not found");

  if (user.role === "ADMIN" && toDbRole(role) !== "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", deletedAt: null } });
    if (admins <= 1) throw errors.conflict("Cannot demote the last admin");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: toDbRole(role) },
    select: { id: true, email: true, role: true },
  });
  return { id: updated.id, email: updated.email, role: toWireRole(updated.role) };
}

export async function resetUserPassword(id: number, newPassword: string) {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw errors.badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const user = await prisma.user.findUnique({ where: { id, deletedAt: null } });
  if (!user) throw errors.notFound("User not found");

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
}

export async function deactivateUser(id: number) {
  const user = await prisma.user.findUnique({ where: { id, deletedAt: null } });
  if (!user) throw errors.notFound("User not found");

  if (user.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", deletedAt: null } });
    if (admins <= 1) throw errors.conflict("Cannot deactivate the last admin");
  }

  await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
}
