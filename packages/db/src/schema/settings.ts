import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core"

/**
 * Singleton app settings — exactly one row (id = 'app').
 * Used for maintenance mode, global announcements, etc.
 */
export const appSettings = pgTable("app_settings", {
  id: varchar("id", { length: 32 }).primaryKey().default("app"),

  maintenanceMode: varchar("maintenance_mode", { length: 8 })
    .notNull()
    .default("off"),
  maintenanceReason: varchar("maintenance_reason", { length: 500 }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type AppSettings = typeof appSettings.$inferSelect
export type NewAppSettings = typeof appSettings.$inferInsert
