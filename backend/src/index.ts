import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";

const app = createApp();

async function main() {
  try {
    await prisma.$connect();
    app.listen(env.PORT, () => {
      console.log(`Roti Chani API listening on port ${env.PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();
