import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"

import { users } from "./users"

/**
 * The resumable notification pipeline:
 *
 *   registry PR merged -> diff detected -> one batch + N personalized messages
 *   stored here (status PENDING) -> admin opens Notification Center and hits
 *   "Send unsent" -> sender claims PENDING rows one-by-one (each send commits
 *   its own status change) -> a crash/power-cut leaves at most one row in
 *   SENDING, which the next run resumes.
 *
 * Sending is manual (button) because Vercel serverless functions cannot hold
 * the long-running Telegram fan-out reliably.
 */
export const notificationTypeEnum = pgEnum("notification_type", [
  "COURSE_CHANGES", // generated from a registry semester-file diff
  "ANNOUNCEMENT", // manual broadcast written by an admin
])

export const batchStatusEnum = pgEnum("notification_batch_status", [
  "DRAFT", // being generated, not visible yet
  "READY", // messages stored, waiting for admin to press send
  "SENDING",
  "COMPLETED",
])

export const messageStatusEnum = pgEnum("notification_message_status", [
  "PENDING",
  "SENDING",
  "SENT",
  "FAILED",
])

/** Summary of what changed - rendered in the admin Notification Center. */
export type NotificationBatchPayload = {
  universitySlug: string
  majorSlug: string
  semesterFile: string // e.g. "[1403-1404]/mehr.json"
  diffId?: string // UUID from diff.json - once marked completed it never shows again
  added: number
  removed: number
  changed: number
}

export const notificationBatches = pgTable(
  "notification_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    type: notificationTypeEnum("type").notNull(),
    status: batchStatusEnum("status").notNull().default("DRAFT"),

    title: varchar("title", { length: 255 }).notNull(),

    // null = broadcast to everyone
    universitySlug: varchar("university_slug", { length: 128 }),
    majorSlug: varchar("major_slug", { length: 128 }),

    payload: jsonb("payload").$type<NotificationBatchPayload | null>(),

    diffId: uuid("diff_id"),

    totalMessages: integer("total_messages").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),

    createdById: bigint("created_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" }
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notification_batches_status_idx").on(table.status, table.createdAt),
    unique("notification_batches_diff_id_unique").on(table.diffId),
  ]
)

export type NotificationBatch = InferSelectModel<typeof notificationBatches>
export type NewNotificationBatch = InferInsertModel<typeof notificationBatches>

/**
 * One Telegram message per row. `chatId` is denormalized from `users` on
 * purpose: if a user deletes their account mid-campaign, already-generated
 * messages must still be auditable, and the sender must not join per send.
 */
export const notificationMessages = pgTable(
  "notification_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    batchId: uuid("batch_id")
      .notNull()
      .references(() => notificationBatches.id, { onDelete: "cascade" }),

    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatId: bigint("chat_id", { mode: "number" }).notNull(),

    body: text("body").notNull(),

    status: messageStatusEnum("status").notNull().default("PENDING"),

    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Resume query: WHERE batch_id = $1 AND status IN ('PENDING','SENDING')
    // ORDER BY created_at - covered by this index.
    index("notification_messages_batch_status_idx").on(
      table.batchId,
      table.status,
      table.createdAt
    ),
    unique("notification_messages_batch_user_unique").on(
      table.batchId,
      table.userId
    ),
    check(
      "notification_messages_attempts_range",
      sql`${table.attempts} >= 0 AND ${table.attempts} <= ${table.maxAttempts}`
    ),
  ]
)

export type NotificationMessage = InferSelectModel<typeof notificationMessages>
export type NewNotificationMessage = InferInsertModel<
  typeof notificationMessages
>

/**
 * Last snapshot content per term that the detect pipeline already turned
 * into a batch. Detect diffs new.json against THIS (not old.json), so
 * deleting a batch and editing new.json can never resurrect already-seen
 * changes as a "combined" batch — no registry rotation required.
 * First runs fall back to old.json and seed the row implicitly.
 */
export const offeringNotifyBaselines = pgTable(
  "offering_notify_baselines",
  {
    universitySlug: varchar("university_slug", { length: 128 }).notNull(),
    majorSlug: varchar("major_slug", { length: 128 }).notNull(),
    year: varchar("year", { length: 8 }).notNull(),
    semester: varchar("semester", { length: 16 }).notNull(),

    /** Canonical content hash (see lib/notifications/diff-identity). */
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    /** Full snapshot the hash was computed from (JSON array of offerings). */
    offerings: jsonb("offerings").notNull().$type<unknown[]>(),

    notifiedAt: timestamp("notified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.universitySlug,
        table.majorSlug,
        table.year,
        table.semester,
      ],
      name: "offering_notify_baselines_pkey",
    }),
  ]
)

export type OfferingNotifyBaseline = InferSelectModel<
  typeof offeringNotifyBaselines
>
export type NewOfferingNotifyBaseline = InferInsertModel<
  typeof offeringNotifyBaselines
>
