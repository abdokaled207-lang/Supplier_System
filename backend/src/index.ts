import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./db/prisma";

const app = createApp();

async function main() {
  try {
    await prisma.$connect();
    app.listen(env.PORT, () => {
      console.log(`Roti Chani API listening on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();
