import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "mysql://test:test@localhost:3306/roti_chani_system_test",
      JWT_SECRET: "test-secret-for-vitest",
    },
  },
});
