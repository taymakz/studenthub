import { z } from "zod"

import { slugSchema, type Semester } from "./shared"

/**
 * Entry semester a chart file applies to - superset of the real offering
 * semesters: BOTH marks the shared `both.json` file that covers MEHR and
 * BAHMAN entrants with ONE document instead of two duplicated files.
 */
export const chartSemesterSchema = z.enum(["MEHR", "BAHMAN", "BOTH"])

export type ChartSemester = z.infer<typeof chartSemesterSchema>

/**
 * One course line inside a curriculum chart. Prerequisites reference course NAMES.
 */
export const chartCourseSchema = z.object({
  name: z.string().min(1).max(255),
  theoreticalUnits: z.number().int().min(0).max(20),
  practicalUnits: z.number().int().min(0).max(20),
  /** Prerequisites: course NAMES (string[]) or required passed units (number, e.g. 100) or required terms (e.g. { term: 5 } for گذراندن 5 نیمسال). */
  prerequisites: z
    .union([
      z.array(z.string().max(255)),
      z.number().int().min(1).max(500),
      z.object({ term: z.number().int().min(1).max(20) }),
    ])
    .default([]),
  /** Corequisites: course NAMES */
  corequisites: z.array(z.string().max(255)).default([]),
})

export type ChartCourse = z.infer<typeof chartCourseSchema>

/**
 * An elective bucket: the student must pick `requiredUnits` worth of units
 * from `courses` during the given terms. `minPracticalUnits` optionally
 * enforces a lab/workshop (عملی/آزمایشگاه) minimum within the selection.
 */
export const electiveGroupSchema = z.object({
  title: z.string().min(1).max(255),
  /** Minimum units that must be selected from this group overall. */
  requiredUnits: z.number().int().min(1).max(60),
  /** Term numbers (keys of `terms`) where group courses may be taken. */
  allowedTerms: z.array(z.number().int().min(1).max(20)).default([]),
  /** The pool of courses belonging to this elective group. */
  courses: z.array(chartCourseSchema).default([]),
  /** Optional minimum of practical (lab/workshop) units within the pick. */
  minPracticalUnits: z.number().int().min(0).max(60).optional(),
})

export type ElectiveGroup = z.infer<typeof electiveGroupSchema>

/**
 * File: .../majors/<majorSlug>/charts/<degreeSlug>/<yearDir>/<semester>.json
 *
 * `<yearDir>` is the entry-cohort directory: a range like "[1403-1404]" or a
 * single year like "1405". `<semester>` is the entry semester (MEHR / BAHMAN)
 * - students entering in Mehr follow the mehr.json chart. Summer has no chart.
 * When MEHR and BAHMAN entrants share an identical curriculum, one `both.json`
 * (semester: "BOTH") replaces both files; mehr.json/bahman.json must not
 * exist beside it.
 *
 * Term keys are strings "1".."N" (JSON objects always stringify keys).
 * `moaref` holds the معارف courses common to all terms. `unknown` holds
 * courses whose term is not decided yet - they float until a contributor
 * assigns them.
 */
export const chartDocSchema = z.object({
  $schema: z.string().optional(),
  type: z.literal("chart").optional(),
  degree: slugSchema.optional(),
  semester: chartSemesterSchema.optional(),
  isCompleted: z.boolean().default(false),
  terms: z.record(
    z.string().regex(/^[1-9][0-9]*$/),
    z.array(chartCourseSchema)
  ),
  moaref: z.array(chartCourseSchema).default([]),
  unknown: z.array(chartCourseSchema).default([]),
  electives: z.record(slugSchema, electiveGroupSchema).default({}),
})

export type ChartDoc = z.infer<typeof chartDocSchema>

/** Semesters actually covered by a chart doc (BOTH fans out to two). */
export function coveredSemesters(semester: ChartSemester): Semester[] {
  return semester === "BOTH" ? ["MEHR", "BAHMAN"] : [semester]
}

/**
 * File: .../majors/<majorSlug>/charts/<degreeSlug>/meta.json
 * Degree-level metadata for charts — keeps termCount and display name
 * alongside the degree folder instead of only in major.json.
 */
export const chartDegreeMetaSchema = z.object({
  $schema: z.string().optional(),
  type: z.literal("chart-degree").optional(),
  slug: slugSchema,
  name: z.object({
    fa: z.string().min(1).max(255),
    en: z.string().min(1).max(255).optional(),
  }),
  /** Standard curriculum length (e.g. 8 for بکارشناسی پیوسته) — هرچی اینجا باشه ملاکه */
  termCount: z.number().int().min(1),
  /** Maximum with سنوات مجاز — required, no default, هرچی اینجا باشه ملاکه */
  maxTermCount: z.number().int().min(1),
})

export type ChartDegreeMeta = z.infer<typeof chartDegreeMetaSchema>
