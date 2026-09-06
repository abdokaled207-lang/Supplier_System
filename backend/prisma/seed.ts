import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db/prisma";

const PRODUCTS = [
  { productName: "Roti Chani Plain", unitPrice: 10, stockQuantity: 0 },
  { productName: "Roti Chani Cheese", unitPrice: 15, stockQuantity: 0 },
  { productName: "Roti Chani Chicken", unitPrice: 25, stockQuantity: 0 },
  { productName: "Roti Chani Special", unitPrice: 30, stockQuantity: 0 },
];

async function main() {
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { productName: p.productName },
      update: {},
      create: p,
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@roti.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: { email: adminEmail, passwordHash, role: "ADMIN" },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
