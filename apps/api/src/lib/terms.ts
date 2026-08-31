import type { Semester } from "@workspace/registry"

/**
 * University-website term numbering, e.g. 1405 → 4051 (مهر), 4052 (بهمان),
 * 4053 (تابستان); next year is 4061... The mini app shows
 * «1405 مهر (4051)» and users pick terms by this code.
 */

const SEMESTER_ORDER: Record<Semester, 1 | 2 | 3> = {
  MEHR: 1,
  BAHMAN: 2,
  SUMMER: 3,
}

const BY_INDEX: Record<"1" | "2" | "3", Semester> = {
  "1": "MEHR",
  "2": "BAHMAN",
  "3": "SUMMER",
}

/** 1405 + MEHR -> "4051". */
export function formatTermCode(year: number, semester: Semester): string {
  return `${String(year).slice(-3)}${SEMESTER_ORDER[semester]}`
}

/** "4051" -> { year: 1405, semester: "MEHR" }; null when malformed. */
export function parseTermCode(
  code: string
): { year: number; semester: Semester } | null {
  if (!/^\d{4}$/.test(code)) return null
  const semester = BY_INDEX[code.slice(3) as "1" | "2" | "3"]
  const shortYear = Number.parseInt(code.slice(0, 3), 10)
  if (!semester || !Number.isFinite(shortYear)) return null
  const year = 1000 + shortYear // "405" -> 1405
  if (year < 1300 || year > 1500) return null
  return { year, semester }
}

const FA_SEMESTER: Record<Semester, string> = {
  MEHR: "مهر",
  BAHMAN: "بهمن",
  SUMMER: "تابستان",
}

function toFa(value: number | string): string {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)] ?? d)
}

/** «1405 مهر (4051)» display label. */
export function termLabelWithCode(year: number, semester: Semester): string {
  return `${toFa(year)} ${FA_SEMESTER[semester]} (${toFa(formatTermCode(year, semester))})`
}

/** Current Jalali year/month via Intl (no extra dep). */
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

/**
 * Current term code (4051 etc.) per product spec:
 * - شهریور (6) تا 2 ماه قبل بهمن (آذر 9) => MEHR (4051)
 * - 2 ماه قبل بهمن (9) تا 1 ماه قبل خرداد (2) => BAHMAN (4052) — wraps year, Farvardin/Ordibehesht count as previous year
 * - others (3-5) => SUMMER (4053)
 * If year is ambiguous for BAHMAN in Farvardin/Ordibehesht, previous Jalali year is used.
 */
export function getCurrentTerm(): {
  year: number
  semester: Semester
  code: string
  label: string
} {
  const { year: jy, month } = getCurrentJalali()
  let year = jy
  let semester: Semester = "MEHR"

  if (month >= 6 && month <= 8) {
    semester = "MEHR"
  } else if (month >= 9 && month <= 12) {
    semester = "BAHMAN"
  } else if (month === 1 || month === 2) {
    // Farvardin/Ordibehesht still belong to previous year's Bahman term
    year = jy - 1
    semester = "BAHMAN"
  } else {
    // 3,4,5 => Summer of current year
    semester = "SUMMER"
  }

  const code = formatTermCode(year, semester)
  return { year, semester, code, label: termLabelWithCode(year, semester) }
}

export function getCurrentTermCode(): string {
  return getCurrentTerm().code
}
