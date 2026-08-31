import {
  bigint,
  index,
  integer,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"

/**
 * OTP codes for admin dashboard login. Delivered through the Telegram bot, so
 * no SMS provider is needed. Codes are stored hashed; without Redis this table
 * is the ephemeral store - expired/consumed rows are pruned opportunistically.
 */
export const adminLoginCodes = pgTable(
  "admin_login_codes",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedByDefaultAsIdentity(),

    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),

    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("admin_login_codes_chat_created_idx").on(
      table.chatId,
      table.createdAt
    ),
  ]
)

export type AdminLoginCode = InferSelectModel<typeof adminLoginCodes>
export type NewAdminLoginCode = InferInsertModel<typeof adminLoginCodes>
