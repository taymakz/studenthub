import {
  bigint,
  boolean,
  index,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"

/**
 * Users are identified by their Telegram chat id - the same id the bot uses to
 * deliver notifications. There is no email/phone auth in v1: the mini app
 * authenticates via Telegram initData and the admin dashboard via chat id +
 * OTP code sent through the bot.
 */
export const userRoleEnum = pgEnum("user_role", [
  "USER",
  "ADMIN",
  "SUPERADMIN",
  "NOTIFICATIONER",
])

export const users = pgTable(
  "users",
  {
    // Telegram chat id (bigint-safe: JS number is fine up to 2^53).
    id: bigint("id", { mode: "number" }).primaryKey(),

    telegramUsername: varchar("telegram_username", { length: 64 }),
    firstName: varchar("first_name", { length: 255 }).notNull(),
    lastName: varchar("last_name", { length: 255 }),
    languageCode: varchar("language_code", { length: 10 }),
    photoUrl: varchar("photo_url", { length: 2048 }),

    isPremium: boolean("is_premium").notNull().default(false),
    allowsWriteToPm: boolean("allows_write_to_pm").notNull().default(false),

    role: userRoleEnum("role").notNull().default("USER"),

    /** Registry/extension/chart contributors - set manually by an admin. */
    isContributor: boolean("is_contributor").notNull().default(false),

    /** Show this user in course student lists (legacy feature parity). */
    visibleInCourseLists: boolean("visible_in_course_lists")
      .notNull()
      .default(true),
    visibleInCourseListsLastUpdated: timestamp(
      "visible_in_course_lists_last_updated",
      { withTimezone: true }
    ),

    /** Auto-decline every incoming friend request (sender gets a generic rejection, nothing is stored). */
    autoDeclineFriendRequests: boolean("auto_decline_friend_requests")
      .notNull()
      .default(false),

    banned: boolean("banned").notNull().default(false),
    bannedReason: varchar("banned_reason", { length: 255 }),

    lastOnlineAt: timestamp("last_online_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("users_role_idx").on(table.role),
    index("users_banned_idx").on(table.banned),
    index("users_telegram_username_idx").on(table.telegramUsername),
  ]
)

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>
