import type { Semester } from "./types";

/**
 * Shamsi (Jalali) calendar helpers built on Intl's `persian` calendar -
 * shipped by every Chromium, no algorithm tables needed.
 */

export interface JalaliDate {
  /** Shamsi year, e.g. 1404 */
  jy: number;
  /** Shamsi month 1..12 (1 = Farvardin, 7 = Mehr, 11 = Bahman) */
  jm: number;
  jd: number;
}

export function currentJalali(now: Date = new Date()): JalaliDate {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(now);

    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN);

    const jy = get("year");
    const jm = get("month");
    const jd = get("day");

    if (
      Number.isFinite(jy) &&
      Number.isFinite(jm) &&
      Number.isFinite(jd)
    ) {
      return { jy, jm, jd };
    }
  } catch {
    // Persian calendar unavailable (should not happen in Chromium).
  }

  // Fallback approximation: good enough for a year dropdown.
  const gy = now.getFullYear();
  const gm = now.getMonth() + 1;
  const jy = gm >= 3 ? gy - 621 : gy - 622;
  const jm = ((gm + 9) % 12) + 1;
  return { jy, jm, jd: now.getDate() };
}

/**
 * Map the current Shamsi month to the university term:
 *
 *   Shahrivar (6) .. Aban (8)          -> MEHR    (ترم مهر + ثبت نام آن)
 *   Azar (9) .. Esfand (12)            -> BAHMAN  (۲ ماه قبل بهمن شروع می‌شود)
 *   Farvardin (1)                      -> BAHMAN  (امتحانات/ادامه نیمسال دوم)
 *   Ordibehesht (2) .. Mordad (5)      -> SUMMER  (تابستان)
 *
 * The term's registry YEAR is the academic-year label:
 *   - Mehr of Shamsi year Y            -> Y
 *   - Bahman months 9..12 of year Y    -> Y   (Bahman semester of year Y)
 *   - Farvardin of year Y+1            -> Y   (still the Bahman semester)
 *   - Summer months 2..5 of year Y     -> Y   (تابستان قبل از مهر Y)
 */
export function detectTerm(now: Date = new Date()): {
  year: number;
  semester: Semester;
} {
  const { jy, jm } = currentJalali(now);

  if (jm >= 6 && jm <= 8) {
    return { year: jy, semester: "MEHR" };
  }
  if (jm >= 9 || jm === 1) {
    return { year: jm === 1 ? jy - 1 : jy, semester: "BAHMAN" };
  }
  return { year: jy, semester: "SUMMER" };
}

/** Dropdown options: current Shamsi year -5 .. +5, newest first. */
export function buildYearOptions(now: Date = new Date()): number[] {
  const { jy } = currentJalali(now);
  const years: number[] = [];
  for (let y = jy + 5; y >= jy - 5; y--) years.push(y);
  return years;
}
