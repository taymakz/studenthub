import {
  bigint,
  boolean,
  check,
  index,
  pgTable,
  smallint,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"

import { users } from "./users"

/**
 * Professor rating votes. Professors themselves live in the registry
 * (majors/<majorSlug>/professors.json); only votes are user-generated state.
 * `professorSlug` is the registry id of the professor.
 *
 * Ratings are 1..5, mirroring the old system's five bars: exam difficulty,
 * teaching quality per session, mastery, leniency (ارفاق), and how similar
 * exam questions are to class notes.
 */
export const professorVotes = pgTable(
  "professor_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    universitySlug: varchar("university_slug", { length: 128 }).notNull(),
    majorSlug: varchar("major_slug", { length: 128 }).notNull(),
    professorSlug: varchar("professor_slug", { length: 128 }).notNull(),

    examDifficulty: smallint("exam_difficulty").notNull(),
    teachingQuality: smallint("teaching_quality").notNull(),
    mastery: smallint("mastery").notNull(),
    leniency: smallint("leniency").notNull(),
    questionSimilarity: smallint("question_similarity").notNull(),

    providesSampleQuestions: boolean("provides_sample_questions")
      .notNull()
      .default(false),
    providesNotes: boolean("provides_notes").notNull().default(false),
    mandatoryAttendance: boolean("mandatory_attendance")
      .notNull()
      .default(false),

    comment: varchar("comment", { length: 500 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("professor_votes_user_professor_unique").on(
      table.userId,
      table.professorSlug
    ),
    index("professor_votes_professor_idx").on(
      table.universitySlug,
      table.majorSlug,
      table.professorSlug
    ),
    check(
      "professor_votes_exam_difficulty_range",
      sql`${table.examDifficulty} BETWEEN 1 AND 5`
    ),
    check(
      "professor_votes_teaching_quality_range",
      sql`${table.teachingQuality} BETWEEN 1 AND 5`
    ),
    check(
      "professor_votes_mastery_range",
      sql`${table.mastery} BETWEEN 1 AND 5`
    ),
    check(
      "professor_votes_leniency_range",
      sql`${table.leniency} BETWEEN 1 AND 5`
    ),
    check(
      "professor_votes_question_similarity_range",
      sql`${table.questionSimilarity} BETWEEN 1 AND 5`
    ),
  ]
)

export type ProfessorVote = InferSelectModel<typeof professorVotes>
export type NewProfessorVote = InferInsertModel<typeof professorVotes>
