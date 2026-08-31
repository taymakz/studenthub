/** Client-side term code helpers (mirrors apps/api/src/lib/terms.ts) */

export type Semester = "MEHR" | "BAHMAN" | "SUMMER"

const SEMESTER_ORDER: Record<Semester, 1 | 2 | 3> = {
  MEHR: 1,
  BAHMAN: 2,
  SUMMER: 3,
}

export function formatTermCode(year: number, semester: Semester): string {
  return `${String(year).slice(-3)}${SEMESTER_ORDER[semester]}`
}

export function getCurrentJalali(): { year: number; month: number } {
  const fmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "numeric",
    numberingSystem: "latn",
  })
  const parts = fmt.formatToParts(new Date())
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "1404")
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1")
  return { year, month }
}

export function getCurrentTerm(): {
  year: number
  semester: Semester
  code: string
} {
  const { year: jy, month } = getCurrentJalali()
  let year = jy
  let semester: Semester = "MEHR"
  if (month >= 6 && month <= 8) {
    semester = "MEHR"
  } else if (month >= 9 && month <= 12) {
    semester = "BAHMAN"
  } else if (month === 1 || month === 2) {
    year = jy - 1
    semester = "BAHMAN"
  } else {
    semester = "SUMMER"
  }
  return { year, semester, code: formatTermCode(year, semester) }
}

/* ─── نیم‌سال availability helpers ─── */

/**
 * The newest available term code strictly newer than the user's selected one,
 * or null when the user is already on the latest. Codes are 4-digit numbers
 * (4051 < 4052 < 4061), so numeric comparison is the ordering.
 */
export function findNewerSemesterCode(
  selectedCode: string | null | undefined,
  availableCodes: string[]
): string | null {
  if (!selectedCode || availableCodes.length === 0) return null
  const selected = Number(selectedCode)
  const newer = availableCodes
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > selected)
    .sort((a, b) => a - b)
  return newer.length > 0 ? String(newer[newer.length - 1]) : null
}

/** Newest available code overall (fallback when the user has none selected). */
export function latestSemesterCode(availableCodes: string[]): string | null {
  if (availableCodes.length === 0) return null
  const sorted = availableCodes.map(Number).sort((a, b) => a - b)
  return String(sorted[sorted.length - 1])
}

/** Inverse of formatTermCode: "4051" -> { year: 1404, semester: "MEHR" }. */
export function parseTermCode(
  code: string
): { year: number; semester: Semester } | null {
  if (!/^\d{4}$/.test(code)) return null
  const orderByIndex: Record<string, Semester> = {
    "1": "MEHR",
    "2": "BAHMAN",
    "3": "SUMMER",
  }
  const semester = orderByIndex[code.slice(3)]
  const shortYear = Number.parseInt(code.slice(0, 3), 10)
  if (!semester || !Number.isFinite(shortYear)) return null
  const year = 1000 + shortYear
  if (year < 1300 || year > 1500) return null
  return { year, semester }
}

export const SEMESTER_FA: Record<Semester, string> = {
  MEHR: "مهر",
  BAHMAN: "بهمن",
  SUMMER: "تابستان",
}
