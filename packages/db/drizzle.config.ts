import { config } from "dotenv"

// Per-project env: no root .env. Load from package dir, then apps/api/.env (DB owner), then fallback.
config()
config({ path: "../../apps/api/.env" })

import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/studenthub",
  },
})
