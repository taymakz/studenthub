import {
  bigint,
  boolean,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"

import { users } from "./users"

/**
 * Courses a student pinned for tracking. `courseIndex` is the offering index
 * (شماره) from the registry semester file - the stable key the change-diff
 * pipeline uses to detect updated/deleted offerings.
 */
export const notedCourses = pgTable(
  "noted_courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    universitySlug: varchar("university_slug", { length: 128 }).notNull(),
    majorSlug: varchar("major_slug", { length: 128 }).notNull(),
    // Pin the student's full profile at note time so each cohort's list is isolated
    entryYearRange: varchar("entry_year_range", { length: 16 }),
    entrySemester: varchar("entry_semester", { length: 8 }),
    courseIndex: varchar("course_index", { length: 64 }).notNull(),
    // Offering index (شماره) is per-term, so pin the نیم سال the note belongs to.
    year: varchar("year", { length: 8 }),
    semester: varchar("semester", { length: 8 }),

    // Soft flag: the offering disappeared from the latest semester snapshot.
    isDeleted: boolean("is_deleted").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("noted_courses_user_course_unique").on(
      table.userId,
      table.universitySlug,
      table.majorSlug,
      table.entryYearRange,
      table.entrySemester,
      table.year,
      table.semester,
      table.courseIndex
    ),
    index("noted_courses_lookup_idx").on(
      table.universitySlug,
      table.majorSlug,
      table.entryYearRange,
      table.entrySemester,
      table.year,
      table.semester,
      table.courseIndex,
      table.isDeleted
    ),
  ]
)

export type NotedCourse = InferSelectModel<typeof notedCourses>
export type NewNotedCourse = InferInsertModel<typeof notedCourses>

/** Courses the student already passed (used to filter notifications). */
export const passedCourses = pgTable(
  "passed_courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    universitySlug: varchar("university_slug", { length: 128 }).notNull(),
    majorSlug: varchar("major_slug", { length: 128 }).notNull(),

    courseName: varchar("course_name", { length: 255 }).notNull(),
    year: varchar("year", { length: 8 }),
    semester: varchar("semester", { length: 8 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("passed_courses_user_course_unique").on(
      table.userId,
      table.universitySlug,
      table.majorSlug,
      table.courseName
    ),
    index("passed_courses_user_idx").on(table.userId),
  ]
)

export type PassedCourse = InferSelectModel<typeof passedCourses>
export type NewPassedCourse = InferInsertModel<typeof passedCourses>

/** Courses the student retakes because they have not passed them yet. */
export const failedCourses = pgTable(
  "failed_courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    universitySlug: varchar("university_slug", { length: 128 }).notNull(),
    majorSlug: varchar("major_slug", { length: 128 }).notNull(),

    courseName: varchar("course_name", { length: 255 }).notNull(),
    year: varchar("year", { length: 8 }),
    semester: varchar("semester", { length: 8 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("failed_courses_user_course_unique").on(
      table.userId,
      table.universitySlug,
      table.majorSlug,
      table.courseName
    ),
    index("failed_courses_user_idx").on(table.userId),
  ]
)

export type FailedCourse = InferSelectModel<typeof failedCourses>
export type NewFailedCourse = InferInsertModel<typeof failedCourses>
