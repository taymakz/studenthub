import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

export type Database = ReturnType<typeof createDb>

/**
 * Creates a Drizzle client over postgres-js. Safe for serverless: pass
 * `max: 1` (or use the platform pooler) when creating short-lived connections.
 */
export function createDb(
  url: string,
  options?: Parameters<typeof postgres>[1]
) {
  const client = postgres(url, {
    prepare: false,
    ...options,
  })
  return drizzle(client, { schema })
}

export * from "./schema"
export * from "./relations"
