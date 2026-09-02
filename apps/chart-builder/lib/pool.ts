import type { ChartCourse } from "./chart"

/**
 * The course pool: parsed from the StudentHub extension output
 * (`courses/<year>/<semester>.json` - { year, semester, offerings[] } or a
 * bare offerings array). Pool courses are what you pick from when building
 * the chart.
 */
export interface PoolCourse {
  code: string
  name: string
  type: string | null
  theoreticalUnits: number
  practicalUnits: number
  professor: string | null
}

export interface PoolParseResult {
  courses: PoolCourse[]
  error?: string
  /** Raw offering count before dedupe (multiple class sections per course). */
  totalOfferings: number
  /** Detected from the doc wrapper, when present. */
  year?: number
  semester?: string
}

function toEnglishDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (ch) => {
    const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(ch)
    if (persian !== -1) return String(persian)
    return String("٠١٢٣٤٥٦٧٨٩".indexOf(ch))
  })
}

function unifyPersian(text: string): string {
  return text.replace(/\u0643/g, "\u06A9").replace(/\u064A/g, "\u06CC")
}

function clean(value: unknown): string {
  if (value === null || value === undefined) return ""
  return unifyPersian(toEnglishDigits(String(value)))
    .replace(/\s+/g, " ")
    .trim()
}

function toInt(value: unknown): number {
  const normalized = clean(value).replace(/[,،\s]/g, "")
  return /^\d+$/.test(normalized) ? Number(normalized) : 0
}

function toFloatUnits(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : 0
  const raw = clean(value).replace(/[,،\u066C\s]/g, "").replace(/[\u066B\u00B7]/g, ".")
  return /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : 0
}

/**
 * Tolerant JSON parse - strips comments/trailing commas and quotes unquoted
 * keys so half-edited pastes still load.
 */
function tolerantParse(input: string): unknown {
  let text = input.trim()
  text = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "")
  text = text.replace(/,\s*([[\]}])/g, "$1")
  text = text.replace(/([{,]\s*)(\w+)(\s*):/g, '$1"$2"$3:')
  text = text.replace(/:\s*'([^']*)'/g, ': "$1"')
  return JSON.parse(text)
}

export function parsePoolInput(input: string): PoolParseResult {
  if (!input.trim())
    return { courses: [], totalOfferings: 0, error: "ورودی خالی است" }

  let data: unknown
  try {
    data = tolerantParse(input)
  } catch (error) {
    return {
      courses: [],
      totalOfferings: 0,
      error: `JSON نامعتبر: ${error instanceof Error ? error.message : "خطای ناشناخته"}`,
    }
  }

  const offerings = Array.isArray(data)
    ? data
    : typeof data === "object" &&
        data !== null &&
        Array.isArray((data as { offerings?: unknown }).offerings)
      ? (data as { offerings: unknown[] }).offerings
      : null

  if (!offerings) {
    return {
      courses: [],
      totalOfferings: 0,
      error: "ساختار شناسایی نشد - خروجی افزونه را بچسبانید",
    }
  }

  const doc = Array.isArray(data) ? {} : (data as Record<string, unknown>)

  const courses: PoolCourse[] = []
  const seen = new Set<string>()
  for (const raw of offerings) {
    if (typeof raw !== "object" || raw === null) continue
    const o = raw as Record<string, unknown>
    // Accept both registry camelCase and legacy snake_case keys.
    const name = clean(o.courseName ?? o.course_name)
    const code = clean(o.courseCode ?? o.course_code)
    if (!name && !code) continue

    const key = `${code}|${name}`
    if (seen.has(key)) continue
    seen.add(key)

    courses.push({
      code: code || name,
      name: name || code,
      type: clean(o.courseType ?? o.course_type) || null,
      theoreticalUnits: toFloatUnits(o.theoreticalUnits ?? o.theoretical_units),
      practicalUnits: toFloatUnits(o.practicalUnits ?? o.practical_units),
      professor:
        clean(
          typeof o.professor === "object" && o.professor !== null
            ? (o.professor as { fa?: string }).fa
            : o.professor
        ) || null,
    })
  }

  if (courses.length === 0) {
    return {
      courses: [],
      totalOfferings: offerings.length,
      error: "هیچ درسی در ورودی پیدا نشد",
    }
  }

  return {
    courses,
    totalOfferings: offerings.length,
    year: typeof doc.year === "number" ? doc.year : undefined,
    semester: typeof doc.semester === "string" ? doc.semester : undefined,
  }
}

/** Convert a pool course into a fresh chart course line. */
export function poolToChartCourse(course: PoolCourse): ChartCourse {
  return {
    name: course.name,
    theoreticalUnits: course.theoreticalUnits,
    practicalUnits: course.practicalUnits,
    prerequisites: [],
    corequisites: [],
  }
}
