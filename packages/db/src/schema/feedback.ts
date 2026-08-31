import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"

import { users } from "./users"

export const feedbackKindEnum = pgEnum("feedback_kind", [
  // Original set (kept for existing rows; API no longer accepts these).
  "BUG",
  "IDEA",
  "PRAISE",
  "OTHER",
  // Current mini-app taxonomy:
  //   BUG       -> گزارش اشکال
  //   SUGGESTION-> پیشنهادات
  //   THANKS    -> تشکر و قدردانی
  //   SOURCE    -> معرفی منبع (source submissions - engineers add them to
  //                the registry via PR; users propose through feedback)
  "SUGGESTION",
  "THANKS",
  "SOURCE",
])

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "OPEN",
  "RESOLVED",
])

/** Optional attachments, stored as Telegram file_ids (no object storage). */
export type FeedbackAttachment = {
  fileId: string
  fileName?: string
  mimeType?: string
}

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    kind: feedbackKindEnum("kind").notNull().default("BUG"),
    status: feedbackStatusEnum("status").notNull().default("OPEN"),

    message: text("message").notNull(),
    attachments: jsonb("attachments")
      .$type<FeedbackAttachment[]>()
      .notNull()
      .default([]),

    resolvedById: bigint("resolved_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" }
    ),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("feedback_status_created_idx").on(table.status, table.createdAt),
  ]
)

export type Feedback = InferSelectModel<typeof feedback>
export type NewFeedback = InferInsertModel<typeof feedback>
