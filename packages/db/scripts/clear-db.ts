import { config } from "dotenv"

// Works both from the package dir (pnpm scripts) and the repo root.
config()
config({ path: "../../.env" })

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import postgres from "postgres"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function buildConnectionString(): string {
  const directUrl = process.env.DATABASE_URL
  if (directUrl?.trim()) return directUrl.trim()

  const username = encodeURIComponent(process.env.POSTGRES_USER ?? "postgres")
  const password = encodeURIComponent(
    process.env.POSTGRES_PASSWORD ?? "postgres"
  )
  const host = process.env.DATABASE_HOST ?? "localhost"
  const port = process.env.POSTGRES_PORT ?? "5433"
  const database = process.env.POSTGRES_DB ?? "studenthub"

  return `postgres://${username}:${password}@${host}:${port}/${database}`
}

const sql = postgres(buildConnectionString(), { max: 1 })

try {
  console.log("Dropping schemas...")
  await sql`DROP SCHEMA IF EXISTS public CASCADE`
  await sql`CREATE SCHEMA public`
  await sql`GRANT ALL ON SCHEMA public TO public`
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`

  // Apply migration SQL directly.
  // drizzle-kit migrate has a bug where it records the migration as applied but silently
  // skips the SQL execution when the drizzle tracking schema was previously present.
  const migrationDir = path.resolve(__dirname, "../drizzle")
  const sqlFiles = fs
    .readdirSync(migrationDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  if (sqlFiles.length === 0) {
    console.log("No migration files found. Run pnpm generate first.")
    process.exitCode = 1
  } else {
    for (const file of sqlFiles) {
      const content = fs.readFileSync(path.join(migrationDir, file), "utf-8")
      const statements = content
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean)
      let ok = 0
      for (const stmt of statements) {
        await sql.unsafe(stmt)
        ok++
      }

      // Write the drizzle migration tracking entry so `pnpm migrate` exits cleanly (nothing to apply).
      // drizzle-kit uses SHA-256 of the SQL file content as the migration hash.
      const hash = crypto.createHash("sha256").update(content).digest("hex")
      await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
      await sql`
        CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
          id serial PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${Date.now()})
      `

      console.log(`  ${file}: ${ok} statements applied`)
    }
    console.log("✅ Database cleared and migrated.")
  }
} catch (err) {
  console.error("Error:", err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await sql.end()
}
