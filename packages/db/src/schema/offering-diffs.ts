import { bigint, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"

import { users } from "./users"

/**
 * Tracks which offering diffs (by diff.json id UUID) have been marked as
 * completed/dismissed by an admin. Once a UUID is here, the Notification
 * Center never shows its batch again — even if the diff.json still exists.
 * This is how we avoid duplicates: each new.json change gets a fresh UUID,
 * and completing it hides that UUID forever.
 */
export const completedOfferingDiffs = pgTable("completed_offering_diffs", {
  diffId: uuid("diff_id").primaryKey(),
  // Optional: store which term this was for debugging
  universitySlug: varchar("university_slug", { length: 128 }),
  majorSlug: varchar("major_slug", { length: 128 }),
  year: varchar("year", { length: 8 }),
  semester: varchar("semester", { length: 16 }),

  completedById: bigint("completed_by_id", { mode: "number" }).references(
    () => users.id,
    { onDelete: "set null" }
  ),
  completedAt: timestamp("completed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type CompletedOfferingDiff = InferSelectModel<
  typeof completedOfferingDiffs
>
export type NewCompletedOfferingDiff = InferInsertModel<
  typeof completedOfferingDiffs
>
