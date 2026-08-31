/**
 * Shamsi (Jalali) calendar helpers built on Intl's `persian` calendar -
 * shipped by every Chromium, no algorithm tables needed. Mirrors the
 * extension's helper so both sides agree on term detection.
 */

export interface JalaliDate {
  /** Shamsi year, e.g. 1404 */
  jy: number
  /** Shamsi month 1..12 (1 = Farvardin, 7 = Mehr, 11 = Bahman) */
  jm: number
  jd: number
}

export function currentJalali(now: Date = new Date()): JalaliDate {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(now)

    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN)

    const jy = get("year")
    const jm = get("month")
    const jd = get("day")

    if (Number.isFinite(jy) && Number.isFinite(jm) && Number.isFinite(jd)) {
      return { jy, jm, jd }
    }
  } catch {
    // Persian calendar unavailable - fall through to the approximation.
  }

  // Fallback approximation: good enough for a year list.
  const gy = now.getFullYear()
  const gm = now.getMonth() + 1
  const jy = gm >= 3 ? gy - 621 : gy - 622
  const jm = ((gm + 9) % 12) + 1
  return { jy, jm, jd: now.getDate() }
}

/**
 * Map the current Shamsi month to the university entry term:
 *
 *   Mehr (6) .. Aban (8)        -> MEHR   (ترم مهر + ثبت‌نام آن)
 *   Azar (9) .. Esfand (12)     -> BAHMAN (۲ ماه قبل از شروع بهمن)
 *   Farvardin (1)               -> BAHMAN (امتحانات/ادامه نیمسال دوم - سال قبل)
 *   Ordibehesht (2) .. Mordad (5) -> SUMMER
 */
export function detectTerm(now: Date = new Date()): {
  year: number
  semester: "MEHR" | "BAHMAN" | "SUMMER"
} {
  const { jy, jm } = currentJalali(now)

  if (jm >= 6 && jm <= 8) {
    return { year: jy, semester: "MEHR" }
  }
  if (jm >= 9 || jm === 1) {
    return { year: jm === 1 ? jy - 1 : jy, semester: "BAHMAN" }
  }
  return { year: jy, semester: "SUMMER" }
}

/** Year options around the current Shamsi year: jy-6 .. jy+6 ascending. */
export function buildYearOptions(now: Date = new Date()): number[] {
  const { jy } = currentJalali(now)
  const years: number[] = []
  for (let y = jy - 6; y <= jy + 6; y++) years.push(y)
  return years
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹"

/** 1404 -> «۱۴۰۴» for UI labels. */
export function toFaDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d)
}
