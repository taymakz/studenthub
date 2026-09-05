import { type Offering, professorName } from "@/lib/api"
import { joinLocations, joinSchedules } from "@/components/app/profile/schedule-util"

/** Thousands-space formatter for course/class codes. */
export function fmt(code: string | undefined): string {
  return (code ?? "").toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

/** Badge color classes for a unit count. */
export function unitClass(value: number): string {
  const map: Record<string, string> = {
    "0.5":
      "bg-yellow-600 text-white dark:bg-yellow-400/10 dark:text-yellow-400",
    "1": "bg-cyan-600 text-white dark:bg-cyan-400/10 dark:text-cyan-400",
    "2": "bg-blue-600 text-white dark:bg-blue-400/10 dark:text-blue-400",
    "3": "bg-primary text-white dark:bg-primary/10 dark:text-primary",
    "4": "bg-orange-600 text-white dark:bg-orange-400/10 dark:text-orange-400",
    "6": "bg-warning text-white dark:bg-warning/10 dark:text-warning",
  }
  return map[String(value)] || ""
}

/** formatted line for the single-course action copy/share actions. */
export function courseLine(
  o: Offering,
  mode: "full" | "nameUnit" | "code"
): string {
  const total = (o.theoreticalUnits ?? 0) + (o.practicalUnits ?? 0)
  if (mode === "code") return o.courseCode || "ثبت نشده"
  if (mode === "nameUnit")
    return `${o.courseName} - ${total} واحد - ${o.courseCode}`
  return `📘 ${o.courseName}\nکد درس: ${o.courseCode} · کد ارائه: ${o.classCode} · ${total} واحد\nاستاد: ${professorName(o) ?? "—"}\nمکان: ${joinLocations(o.location) ?? "—"}\nزمان کلاس: ${joinSchedules(o.classSchedule) ?? "—"}\nزمان امتحان: ${o.examSchedule ?? "—"}`
}
