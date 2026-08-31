import { createDb } from "@workspace/db"

import { config } from "@/config"

/**
 * Singleton Drizzle client. `max: 1` keeps serverless instances light; under
 * long-lived bun dev it still behaves like a tiny pool.
 */
export const db = createDb(config.DATABASE_URL, { max: 5 })
