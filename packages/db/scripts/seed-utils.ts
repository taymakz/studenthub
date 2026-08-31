import { config } from "dotenv"

// Works both from the package dir (pnpm scripts) and the repo root.
config()
config({ path: "../../.env" })

import crypto from "node:crypto"
import readline from "node:readline"

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "@workspace/db"

export function getSeedEnv(name: string, fallback?: string): string {
  const value = process.env[name]

  if (value && value.trim()) {
    return value.trim()
  }

  if (fallback !== undefined) {
    return fallback
  }

  throw new Error(`Missing required environment variable: ${name}`)
}

export function getSeedNumberEnv(name: string, fallback: number): number {
  const value = process.env[name]

  if (!value || !value.trim()) {
    return fallback
  }

  const parsedValue = Number(value)

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Environment variable ${name} must be a number`)
  }

  return parsedValue
}

function buildSeedConnectionString(): string {
  const directUrl = process.env.DATABASE_URL

  if (directUrl && directUrl.trim()) {
    return directUrl.trim()
  }

  const username = encodeURIComponent(getSeedEnv("POSTGRES_USER", "postgres"))
  const password = encodeURIComponent(
    getSeedEnv("POSTGRES_PASSWORD", "postgres")
  )
  const host = getSeedEnv("DATABASE_HOST", "localhost")
  const port = getSeedNumberEnv("POSTGRES_PORT", 5433)
  const database = getSeedEnv("POSTGRES_DB", "studenthub")

  return `postgres://${username}:${password}@${host}:${port}/${database}`
}

export function createSeedClient() {
  const connection = postgres(buildSeedConnectionString(), {
    max: getSeedNumberEnv("DATABASE_POOL_SIZE", 10),
  })

  const db = drizzle(connection, { schema })

  return {
    connection,
    db,
    async close() {
      await connection.end()
    },
  }
}

/** SHA-256 hex hash - used for OTP codes, never for secrets at rest. */
export function hashSeedValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function randomDateWithinDays(days: number, offset = 0): Date {
  const now = Date.now()
  const span = days * 24 * 60 * 60 * 1000
  return new Date(now - span - offset * 15 * 60 * 1000)
}

/**
 * Fake-but-plausible Telegram chat ids for development. Kept far away from any
 * real id range so mock data can be spotted (and wiped) instantly.
 */
export function makeFakeChatId(index: number): number {
  return 700_000_000 + index
}

export function pickFrom<T>(items: readonly T[], index: number): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list")
  }

  return items[index % items.length]!
}

export function chunkArray<T>(items: readonly T[], size = 50): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

export function question(prompt: string): Promise<string> {
  const interfaceInstance = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    interfaceInstance.question(prompt, (answer) => {
      interfaceInstance.close()
      resolve(answer)
    })
  })
}

export async function askYesNo(
  prompt: string,
  defaultValue = false
): Promise<boolean> {
  const answer = (await question(prompt)).trim().toLowerCase()

  if (!answer) {
    return defaultValue
  }

  return ["y", "yes", "true", "1"].includes(answer)
}
