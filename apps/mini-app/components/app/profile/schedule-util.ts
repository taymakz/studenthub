/** Robust, format-tolerant parsing of free-text schedule strings (registry offerings). */

// Match the weekday at the START of the schedule. Persian weekday names are
// written with a ZWNJ (U+200C) or a plain space («سه‌شنبه»/«سه شنبه»), so allow
// both. A substring match is wrong — «پنج‌شنبه» and «سه‌شنبه» both contain «شنبه».
const DAY_RE =
  /^(?:شنبه|یک[\s\u200c]*شنبه|دو[\s\u200c]*شنبه|سه[\s\u200c]*شنبه|چهار[\s\u200c]*شنبه|پنج[\s\u200c]*شنبه|جمعه)/

function canonicalDay(d: string): string {
  return d.replace(/[\s\u200c]/g, "")
}

/** Canonical (space + ZWNJ stripped) form of a Persian weekday, for comparisons. */
export function normalizeDay(d: string | null | undefined): string | null {
  return d ? canonicalDay(d) : null
}

export function extractWeekday(
  schedule: string | null | undefined
): string | null {
  if (!schedule) return null
  const m = schedule.trim().match(DAY_RE)
  return m ? canonicalDay(m[0]) : null
}

/** All HH:MM tokens (start + end when both present). */
export function extractTimes(schedule: string | null | undefined): string[] {
  if (!schedule) return []
  const matches = schedule.matchAll(/\b(\d{1,2}:\d{2})\b/g)
  return [...matches].map((m) => m[1]!)
}

/** YYYY/MM/DD (or -) date; returns the canonical "YYYY/MM/DD" or null. */
export function extractDate(
  schedule: string | null | undefined
): string | null {
  if (!schedule) return null
  const m = schedule.match(/(\d{4})[/\-\u2013](\d{1,2})[/\-\u2013](\d{1,2})/)
  if (!m) return null
  const y = m[1]
  const mo = m[2]
  const d = m[3]
  if (!y || !mo || !d) return null
  return `${y}/${mo.padStart(2, "0")}/${d.padStart(2, "0")}`
}

/* ─── Persian date math (jalaali-js core, trimmed) — for «چند روز مونده» ─── */

function div(a: number, b: number): number {
  return ~~(a / b)
}
function mod(a: number, b: number): number {
  return a - ~~(a / b) * b
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 2061, 2092, 2092, 2092,
  ]
  const bl = breaks.length
  const gy = jy + 621
  let leapJ = -14
  let jp = breaks[0]!
  let jump = 0
  if (jy < jp || jy >= breaks[bl - 1]!)
    throw new Error(`Invalid Jalaali year ${jy}`)
  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i]!
    jump = jm - jp
    if (jy < jm) break
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  let n = jy - jp
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return { leap, gy, march }
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

/** Today's Persian date as "YYYY/MM/DD" (Latin digits). */
export function getCurrentDatePersian(): string {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "1"
  const y = get("year").replace(/\D/g, "")
  const m = get("month").replace(/\D/g, "")
  const d = get("day").replace(/\D/g, "")
  return `${y}/${m.padStart(2, "0")}/${d.padStart(2, "0")}`
}

/** b - a in days (both "YYYY/MM/DD" Persian). */
export function persianDateDiff(a: string, b: string): number {
  const pa = a.split("/").map(Number)
  const pb = b.split("/").map(Number)
  if (
    pa.length !== 3 ||
    pb.length !== 3 ||
    pa.some((n) => !Number.isFinite(n)) ||
    pb.some((n) => !Number.isFinite(n))
  ) {
    throw new Error("Invalid Persian date")
  }
  return j2d(pb[0]!, pb[1]!, pb[2]!) - j2d(pa[0]!, pa[1]!, pa[2]!)
}

/** «۳ روز دیگه» / «۲ هفته دیگه» / «۱ ماه دیگه» / «۱ سال دیگه» */
export function formatDaysRemainInPersian(days: number): string {
  if (days < 7) return `${days} روز دیگه`
  if (days < 30) return `${Math.floor(days / 7)} هفته دیگه`
  if (days < 365) return `${Math.floor(days / 29)} ماه دیگه`
  return `${Math.floor(days / 365)} سال دیگه`
}

/** Format a "YYYY/MM/DD" Persian date string as "شنبه ۲۴ شهریور" (weekday + day + month, no year). */
export function formatPersianDateLong(dateStr: string): string | null {
  const parts = dateStr.split("/").map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  const [jy, jm, jd] = parts as [number, number, number]
  // Convert Jalali → Julian Day → JS Date (Gregorian)
  const jdn = j2d(jy, jm, jd)
  const jsDate = new Date((jdn - 2440587.5) * 86_400_000)
  // Format back as Persian calendar (weekday + month + day)
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(jsDate)
}

/** Weekday name N days from today (N=0 → today's weekday). */
export function persianWeekDayFromDays(days: number): string | null {
  const order = [
    "شنبه",
    "یکشنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنجشنبه",
    "جمعه",
  ]
  const today = getCurrentDatePersian()
  // Jan 1 2025 was a دوشنبه in the Persian calendar anchor — derive today's index instead:
  const fmt = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    weekday: "long",
  }).format(new Date())
  const norm = fmt.replace(/[\s\u200c]/g, "")
  const todayIdx = order.findIndex((d) => d.replace(/[\s\u200c]/g, "") === norm)
  if (todayIdx < 0) return null
  return order[(todayIdx + days) % 7] ?? null
}
