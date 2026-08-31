export const persianWeekDays = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه شنبه",
  "چهارشنبه",
  "پنج شنبه",
  "جمعه",
] as const

export type PersianWeekDayType = (typeof persianWeekDays)[number]

export type ScheduleCourse = {
  index?: string
  course_code?: string
  course_name: string
  course_unit?: number | string
  class_schedule?: string | null
  exam_schedule?: string | null
  professor?: string | null
  location?: string | null
  term_number?: number
  isMoaref?: boolean
  isUnknown?: boolean
}

export type ExamGroupItem = {
  course: ScheduleCourse
  startTime: string | null
  endTime: string | null
}

export type ExamGroup = {
  date: string
  items: ExamGroupItem[]
}

export function getCourseScheduleDayName(schedule: string): string {
  const dayPart = schedule.trim().split(" از ")[0] || ""
  return (persianWeekDays as readonly string[]).includes(dayPart) ? dayPart : ""
}

export function extractClassScheduleStartTime(
  schedule: string | null
): string | null {
  if (!schedule) return null
  return schedule.split(" از ")[1]?.split(" تا ")[0] ?? null
}

export function extractClassScheduleEndTime(
  schedule: string | null
): string | null {
  if (!schedule) return null
  return schedule.split(" از ")[1]?.split(" تا ")[1] ?? null
}

export function extractExamScheduleStartTime(
  schedule: string | null | undefined
): string | null {
  if (!schedule) return null
  return schedule.split(" از ")[1]?.split(" تا ")[0] ?? null
}

export function extractExamScheduleEndTime(
  schedule: string | null | undefined
): string | null {
  if (!schedule) return null
  return schedule.split(" از ")[1]?.split(" تا ")[1] ?? null
}

export function extractExamScheduleDate(
  schedule: string | undefined
): { year: number; month: number; day: number } | null {
  if (!schedule) return null
  const m = schedule.match(/(\d{4})\/(\d{2})\/(\d{2})/)
  if (!m) return null
  const y = Number.parseInt(m[1]!, 10)
  const mo = Number.parseInt(m[2]!, 10) - 1
  const d = Number.parseInt(m[3]!, 10)
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return null
  return { year: y, month: mo, day: d }
}

export function groupAndSortCoursesByWeekDay(
  courses: ScheduleCourse[]
): { name: string; items: ScheduleCourse[] }[] {
  const map = new Map<string, ScheduleCourse[]>()
  persianWeekDays.forEach((d) => map.set(d, []))
  const noSchedule: ScheduleCourse[] = []

  const sortByTime = (a: ScheduleCourse, b: ScheduleCourse) => {
    const sa = a.class_schedule?.trim() || ""
    const sb = b.class_schedule?.trim() || ""
    if (!sa && !sb) return 0
    if (!sa) return 1
    if (!sb) return -1
    const ta = sa.split(" از ")[1]?.split(" تا ")[0] ?? "00:00"
    const tb = sb.split(" از ")[1]?.split(" تا ")[0] ?? "00:00"
    return ta.localeCompare(tb)
  }

  courses.forEach((c) => {
    const day = getCourseScheduleDayName(c.class_schedule || "")
    if (day && map.has(day as PersianWeekDayType)) {
      map.get(day as PersianWeekDayType)!.push(c)
    } else {
      noSchedule.push(c)
    }
  })

  const result = Array.from(map.entries())
    .map(([name, items]) => ({ name, items: [...items].sort(sortByTime) }))
    .filter((g) => g.items.length > 0)

  if (noSchedule.length > 0) {
    result.push({
      name: "زمان تشکیل مشخص نیست",
      items: [...noSchedule].sort(sortByTime),
    })
  }
  return result
}

export function groupCoursesByExamDate(courses: ScheduleCourse[]): ExamGroup[] {
  const map = new Map<string, ExamGroup["items"]>()
  courses.forEach((c) => {
    const s = c.exam_schedule ?? undefined
    let dateStr = "تاریخ نامشخص"
    if (s) {
      const d = extractExamScheduleDate(s)
      if (d)
        dateStr = `${d.year}/${String(d.month + 1).padStart(2, "0")}/${String(d.day).padStart(2, "0")}`
    }
    const start = s ? extractExamScheduleStartTime(s) : null
    const end = s ? extractExamScheduleEndTime(s) : null
    const arr = map.get(dateStr) || []
    arr.push({ course: c, startTime: start, endTime: end })
    map.set(dateStr, arr)
  })
  return Array.from(map.entries())
    .map(([date, items]) => ({ date, items }))
    .sort((a, b) => {
      if (a.date === "تاریخ نامشخص") return 1
      if (b.date === "تاریخ نامشخص") return -1
      return a.date.localeCompare(b.date)
    })
}

// Graduate progress helpers (pure, reusable in admin and mini-app)
export function calcGraduateProgress(
  allCourses: ScheduleCourse[],
  passedNames: Set<string>
) {
  const valid = allCourses.filter((c) => !c.isUnknown)
  const totalRequired = valid.reduce(
    (s, c) => s + (Number(c.course_unit) || 0),
    0
  )
  const passedUnits = valid
    .filter((c) => c.course_name && passedNames.has(c.course_name))
    .reduce((s, c) => s + (Number(c.course_unit) || 0), 0)
  const remaining = Math.max(0, totalRequired - passedUnits)
  const percent =
    totalRequired > 0
      ? Math.min(100, Math.max(0, (passedUnits / totalRequired) * 100))
      : 0
  return { totalRequired, passedUnits, remaining, percent }
}
