import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"

import { users } from "./users"

/**
 * User uploads are streamed straight to a private Telegram channel/group and
 * only the resulting file_id is persisted - there is no object storage in v1.
 * A submission stays PENDING until an admin turns it into a registry entry
 * (manually, or via the auto-PR bot), then it is marked ADDED_TO_REGISTRY with
 * the PR link for traceability.
 */
export const uploadKindEnum = pgEnum("upload_kind", ["ARCHIVE"])

export const uploadStatusEnum = pgEnum("upload_status", [
  "PENDING",
  "APPROVED", // accepted, waiting to be added to the registry
  "ADDED_TO_REGISTRY",
  "REJECTED",
])

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    kind: uploadKindEnum("kind").notNull().default("ARCHIVE"),
    status: uploadStatusEnum("status").notNull().default("PENDING"),

    telegramFileId: text("telegram_file_id").notNull(),
    fileName: varchar("file_name", { length: 255 }),
    mimeType: varchar("mime_type", { length: 128 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }),

    title: varchar("title", { length: 255 }).notNull(),
    description: varchar("description", { length: 1000 }),

    // Where this belongs in the registry (validated against registry at submit).
    universitySlug: varchar("university_slug", { length: 128 }).notNull(),
    majorSlug: varchar("major_slug", { length: 128 }),

    registryPrUrl: varchar("registry_pr_url", { length: 500 }),

    reviewedById: bigint("reviewed_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" }
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("uploads_status_created_idx").on(table.status, table.createdAt),
    index("uploads_uni_major_idx").on(table.universitySlug, table.majorSlug),
  ]
)

export type Upload = InferSelectModel<typeof uploads>
export type NewUpload = InferInsertModel<typeof uploads>
