import { prisma } from "./src/db/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "./src/middleware/auth";

async function main() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "admin@roti.local" } });
    console.log("user found:", user ? { id: user.id, email: user.email, role: user.role } : null);
    if (user) {
      const ok = await bcrypt.compare("Admin123!", user.passwordHash);
      console.log("password compare:", ok);
      const token = signToken({ id: user.id, email: user.email, role: user.role });
      console.log("token len:", token.length);
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
  await prisma.$disconnect();
}

void main();