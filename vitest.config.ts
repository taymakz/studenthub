import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "apps/api/tests/**/*.test.ts",
      "apps/admin/tests/**/*.test.ts",
      "packages/registry/tests/**/*.test.ts",
      "apps/extension/tests/**/*.test.ts",
      "apps/mini-app/tests/**/*.test.ts",
      "packages/ui/src/lib/**/*.test.ts",
    ],
    exclude: ["node_modules", "dist", ".turbo", "_ignore"],
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/studenthub",
      TELEGRAM_BOT_TOKEN: "test",
      SECRET_KEY: "test",
    },
  },
  resolve: {
    alias: {
      "@workspace/registry": resolve(__dirname, "packages/registry/src"),
      "@workspace/db": resolve(__dirname, "packages/db/src"),
      "@": resolve(__dirname, "apps/api/src"),
    },
  },
});
