import {
  bigint,
  boolean,
  index,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"

import { users } from "./users"

export const genderEnum = pgEnum("gender", ["MALE", "FEMALE"])

/**
 * The semester a student entered the university. Registry chart files use the
 * same values, lowercased: <entryYearRange>/mehr.json | bahman.json | summer.json
 */
export const entrySemesterEnum = pgEnum("entry_semester", [
  "MEHR",
  "BAHMAN",
  "SUMMER",
])

/**
 * A student's university identity. Everything here references the git-based
 * registry (packages/registry) by slug - NOT foreign keys - because the
 * registry lives outside the database:
 *
 *   universitySlug  -> packages/registry/universities/<universitySlug>/
 *   majorSlug       -> .../universities/<universitySlug>/majors/<majorSlug>/
 *   degree          -> major.json#degrees[].name
 *   entryYearRange  -> chart directory name: "[1403-1404]" or a single "1405"
 *   entrySemester   -> <entryYearRange>/<mehr|bahman|summer>.json
 *
 * Rows may dangle when the registry renames/removes entries; the API layer is
 * responsible for validating against the current registry and surfacing a
 * "your chart moved" state instead of hard-failing.
 */
export const universityProfiles = pgTable(
  "university_profiles",
  {
    userId: bigint("user_id", { mode: "number" })
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),

    universitySlug: varchar("university_slug", { length: 128 }),
    majorSlug: varchar("major_slug", { length: 128 }),
    degree: varchar("degree", { length: 128 }),
    entryYearRange: varchar("entry_year_range", { length: 16 }),
    entrySemester: entrySemesterEnum("entry_semester"),

    gender: genderEnum("gender"),
    termNumber: smallint("term_number"),
    isLastTerm: boolean("is_last_term").notNull().default(false),

    /**
     * The نیم‌سال (semester) the student is currently in, as a university
     * website term code: «1405 مهر» = 4051, بهمن = 4052, تابستان = 4053.
     * Auto-filled from the Jalali calendar on profile creation and clamped to
     * the offering terms that actually exist for the student's uni/major.
     */
    currentSemesterCode: varchar("current_semester_code", { length: 4 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Fan-out queries for notifications: all students of university X / major Y.
    index("university_profiles_uni_major_idx").on(
      table.universitySlug,
      table.majorSlug
    ),
    index("university_profiles_chart_idx").on(
      table.universitySlug,
      table.majorSlug,
      table.degree,
      table.entryYearRange,
      table.entrySemester
    ),
  ]
)

export type UniversityProfile = InferSelectModel<typeof universityProfiles>
export type NewUniversityProfile = InferInsertModel<typeof universityProfiles>
