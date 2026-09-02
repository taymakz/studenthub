/**
 * Frontend chart model - mirrors the registry `chartDocSchema` closely but
 * keeps electives as an array (slug is generated) and terms as numbers.
 *
 * Meta that decides WHERE the chart lands in the registry
 * (`charts/<degree>/<yearDir>/<semester>.json`) lives in the builder scope
 * (`lib/scope.ts`): degree here is the content-level مقطع, while entry
 * semesters/years are multi-selects in the scope.
 */

export type Semester = "MEHR" | "BAHMAN" | "SUMMER"

/** A prerequisite is either a list of course names or a minimum
    passed-units threshold (e.g. 100). Corequisites are always courses. */
export type RequisiteValue = string[] | number | { term: number }

export interface ChartCourse {
  name: string
  theoreticalUnits: number
  practicalUnits: number
  prerequisites: RequisiteValue
  corequisites: string[]
}

export interface ElectiveGroup {
  slug: string
  title: string
  requiredUnits: number
  allowedTerms: number[]
  courses: ChartCourse[]
  minPracticalUnits?: number
}

export interface ChartState {
  degree: string
  termCount: number
  isCompleted: boolean
  terms: Record<number, ChartCourse[]>
  moaref: ChartCourse[]
  unknown: ChartCourse[]
  electives: ElectiveGroup[]
}

export const DEGREE_OPTIONS = [
  { slug: "associate", label: "کاردانی" },
  { slug: "bachelor", label: "کارشناسی" },
  { slug: "master", label: "کارشناسی ارشد" },
  { slug: "phd", label: "دکتری" },
] as const

export const SEMESTER_OPTIONS: Array<{ value: Semester; label: string }> = [
  { value: "MEHR", label: "مهر" },
  { value: "BAHMAN", label: "بهمن" },
  { value: "SUMMER", label: "تابستان" },
]

/** Entry-cohort options for this builder - charts ship as Mehr/Bahman only
    (تابستان stays valid at the schema level for offerings, not entries). */
export const ENTRY_SEMESTER_OPTIONS = SEMESTER_OPTIONS.filter(
  (option) => option.value !== "SUMMER"
)

export function semesterLabel(semester: Semester): string {
  return (
    SEMESTER_OPTIONS.find((option) => option.value === semester)?.label ??
    semester
  )
}

export function defaultChartState(): ChartState {
  return {
    degree: "bachelor",
    termCount: 8,
    isCompleted: true,
    terms: {},
    moaref: [],
    unknown: [],
    electives: [],
  }
}

/** Total units of a course line. */
export function courseUnits(
  course: Pick<ChartCourse, "theoreticalUnits" | "practicalUnits">
): number {
  return course.theoreticalUnits + course.practicalUnits
}

/** Units inside a term/group. */
export function totalUnits(courses: ChartCourse[]): number {
  return courses.reduce((sum, c) => sum + courseUnits(c), 0)
}

/** URL-safe slug for elective groups (registry slug rules). */
export function slugify(title: string, taken: string[]): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  const safe = base || "group"
  let slug = safe
  let i = 2
  while (taken.includes(slug)) {
    slug = `${safe}-${i++}`
  }
  return slug
}

/** All course names placed anywhere in the chart (for picker filtering). */
export function placedCourseNames(chart: ChartState): Set<string> {
  const names = new Set<string>()
  for (const courses of Object.values(chart.terms)) {
    for (const c of courses) names.add(c.name)
  }
  for (const c of chart.moaref) names.add(c.name)
  for (const c of chart.unknown) names.add(c.name)
  for (const group of chart.electives) {
    for (const c of group.courses) names.add(c.name)
  }
  return names
}

/** Courses available as prerequisites/corequisites for a given course. */
export function requisiteCandidatesForTerm(
  chart: ChartState,
  term: number,
  excludeName: string,
  kind: "prerequisites" | "corequisites" = "prerequisites"
): ChartCourse[] {
  if (kind === "prerequisites" && term === 1) return []
  const seen = new Map<string, ChartCourse>()
  const push = (course: ChartCourse) => {
    if (course.name !== excludeName && !seen.has(course.name)) seen.set(course.name, course)
  }
  for (const [termKey, courses] of Object.entries(chart.terms)) {
    const t = Number(termKey)
    // prerequisites: only previous terms (< term), corequisites: current + previous (<= term)
    if (kind === "prerequisites" ? t >= term : t > term) continue
    for (const course of courses) push(course)
  }
  for (const course of chart.moaref) push(course)
  for (const course of chart.unknown) push(course)
  for (const group of chart.electives) {
    for (const course of group.courses) push(course)
  }
  return [...seen.values()]
}

export function requisiteCandidates(
  chart: ChartState,
  excludeName: string
): ChartCourse[] {
  const seen = new Map<string, ChartCourse>()
  const push = (c: ChartCourse) => {
    if (c.name !== excludeName && !seen.has(c.name)) seen.set(c.name, c)
  }
  for (const courses of Object.values(chart.terms)) {
    for (const c of courses) push(c)
  }
  for (const c of chart.moaref) push(c)
  for (const c of chart.unknown) push(c)
  for (const group of chart.electives) {
    for (const c of group.courses) push(c)
  }
  return [...seen.values()]
}
