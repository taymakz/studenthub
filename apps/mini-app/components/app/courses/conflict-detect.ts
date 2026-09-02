import type { Offering } from "@/lib/api"
import {
  extractTimes,
  extractWeekday,
} from "@/components/app/profile/schedule-util"
import type { ErrorCourseType } from "./sections"

export interface CourseConflict {
  id: string
  reason: string
  type: ErrorCourseType
  courses: Offering[]
  preRequisiteName?: string
  coRequisiteName?: string
  isArrayPreReq?: boolean
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  if (h == null) return 0
  return h * 60 + (m || 0)
}

/** Detect all conflicts among noted offerings.
 *  Mirrors previous project's `getUserCurrentNotedListConflicts` but uses
 *  `profile.isLastTerm` (boolean) instead of `termNumber === maxTermCount`.
 *  Last-term students may take 2 moaref (vs 1) and have other waivers. */
export function detectConflicts(
  notedOfferings: Offering[],
  optsOrMoaref:
    | Set<string>
    | {
        moarefNames: Set<string>
        chartCourses: Array<{
          name: string
          prerequisites: string[] | number | { term: number }
          corequisites: string[]
          courseName?: string
        }>
        passedNames: Set<string>
        failedNames: Set<string>
        isLastTerm?: boolean
        termNumber?: number | null
      },
  maybeIsLastTerm = false
): CourseConflict[] {
  let moarefNames: Set<string>
  let chartCourses: Array<{
    name: string
    prerequisites: string[] | number | { term: number }
    corequisites: string[]
    courseName?: string
  }>
  let passedNames: Set<string>
  let failedNames: Set<string>
  let isLastTerm: boolean
  let termNumber: number | null = null
  if (optsOrMoaref instanceof Set) {
    // Legacy call: detectConflicts(offerings, moarefNames, isLastTerm)
    moarefNames = optsOrMoaref
    chartCourses = []
    passedNames = new Set()
    failedNames = new Set()
    isLastTerm = maybeIsLastTerm
  } else {
    ;({
      moarefNames,
      chartCourses,
      passedNames,
      failedNames,
      isLastTerm = false,
      termNumber = null,
    } = optsOrMoaref as typeof optsOrMoaref & { termNumber?: number | null })
  }
  const out: CourseConflict[] = []
  let id = 0

  const byDay = new Map<string, Offering[]>()
  for (const o of notedOfferings) {
    const day = extractWeekday(o.classSchedule)
    if (!day) continue
    byDay.set(day, [...(byDay.get(day) ?? []), o])
  }
  // Class schedule overlaps — waived for last term
  if (!isLastTerm) {
    for (const [day, group] of byDay.entries()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const ta = extractTimes(group[i]!.classSchedule)
          const tb = extractTimes(group[j]!.classSchedule)
          if (ta.length < 2 || tb.length < 2) continue
          const a = group[i]!
          const b = group[j]!
          const as = toMinutes(ta[0] ?? "0")
          const ae = toMinutes(ta[1] ?? "0")
          const bs = toMinutes(tb[0] ?? "0")
          const be = toMinutes(tb[1] ?? "0")
          if (as < be && bs < ae) {
            out.push({
              id: `sched-${id++}`,
              reason: `تداخل زمانی ${day}`,
              type: "class_schedule",
              courses: [a, b],
            })
          }
        }
      }
    }
  }

  // Exam schedule overlaps — also waived for last term (normalize spacing/ZWNJ/digits)
  if (!isLastTerm) {
    const byExam = new Map<string, Offering[]>()
    for (const o of notedOfferings) {
      if (!o.examSchedule) continue
      const key = o.examSchedule
        .replace(/[\u200c\u200d\u00a0]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
      byExam.set(key, [...(byExam.get(key) ?? []), o])
    }
    for (const [exam, group] of byExam.entries()) {
      if (group.length > 1) {
        out.push({
          id: `exam-${id++}`,
          reason: `تداخل زمان امتحان`,
          type: "exam_schedule",
          courses: group,
        })
      }
    }
  }

  // Moaref: 1 per term, 2 for last term
  const moaref = notedOfferings.filter((o) => moarefNames.has(o.courseName))
  const maxMoaref = isLastTerm ? 2 : 1
  if (moaref.length > maxMoaref) {
    out.push({
      id: `moaref-${id++}`,
      reason: isLastTerm
        ? `در ترم آخر حداکثر ۲ درس معارف مجاز است`
        : `در هر ترم حداکثر ۱ درس معارف مجاز است`,
      type: "moaref",
      courses: moaref,
    })
  }

  // Prerequisites & corequisites (using chart definitions)
  const chartMap = new Map<
    string,
    { prerequisites: string[] | number; corequisites: string[] }
  >()
  for (const c of chartCourses) {
    const name = (c as any).courseName ?? (c as any).name
    if (name)
      chartMap.set(name, {
        prerequisites: (c as any).prerequisites ?? [],
        corequisites: (c as any).corequisites ?? [],
      })
  }

  // Passed units for numeric prerequisites
  const passedUnits = [...passedNames].reduce((sum, name) => {
    const entry = chartCourses.find(
      (x) => ((x as any).courseName ?? (x as any).name) === name
    )
    // Exclude courses whose own prereq is numeric (as in old project)
    if (entry && typeof (entry as any).prerequisites === "number") return sum
    // Find units: try to get from chartCourses' theoretical+ practical? fallback 3
    const units =
      (entry as any)?.course_unit ?? (entry as any)?.theoreticalUnits ?? 0
    return sum + (typeof units === "number" ? units : 3)
  }, 0)

  const preReqMap = new Map<string, Offering[]>()
  const coReqMap = new Map<string, Offering[]>()

  for (const offering of notedOfferings) {
    const entry = chartMap.get(offering.courseName)
    if (!entry) continue

    // Prerequisites — satisfied if passed, OR (failed once AND currently taken
    // together in the noted list). A failed pre-req alone doesn't satisfy — it
    // must also be retaken now (mirrors the spec in
    // packages/registry/tests/conflicts.test.ts).
    const pre = entry.prerequisites
    if (Array.isArray(pre)) {
      for (const reqName of pre) {
        const isPassed = passedNames.has(reqName as string)
        const isFailed = failedNames.has(reqName as string)
        if (isPassed) continue
        if (isFailed) {
          const isNotedTogether = notedOfferings.some(
            (o) => o.courseName === reqName
          )
          if (!isNotedTogether) {
            const arr = preReqMap.get(reqName as string) ?? []
            arr.push(offering)
            preReqMap.set(reqName as string, arr)
          }
        } else {
          const arr = preReqMap.get(reqName as string) ?? []
          arr.push(offering)
          preReqMap.set(reqName as string, arr)
        }
      }
    } else if (typeof pre === "number") {
      if (passedUnits < pre) {
        const key = `حداقل ${pre} واحد`
        const arr = preReqMap.get(key) ?? []
        arr.push(offering)
        preReqMap.set(key, arr)
      }
    } else if (typeof pre === "object" && pre !== null && "term" in pre) {
      const requiredTerm = (pre as { term: number }).term
      const currentTerm = termNumber
      const termSatisfied = currentTerm != null ? currentTerm > requiredTerm : false
      if (!termSatisfied) {
        const key = `گذراندن ${requiredTerm} نیمسال`
        const arr = preReqMap.get(key) ?? []
        arr.push(offering)
        preReqMap.set(key, arr)
      }
    }

    // Corequisites — must be taken together or already passed
    const co = entry.corequisites
    if (Array.isArray(co)) {
      for (const reqName of co) {
        const isPassed = passedNames.has(reqName)
        const isNoted = notedOfferings.some((o) => o.courseName === reqName)
        if (!isPassed && !isNoted) {
          const arr = coReqMap.get(reqName) ?? []
          arr.push(offering)
          coReqMap.set(reqName, arr)
        }
      }
    }
  }

  for (const [name, courses] of preReqMap.entries()) {
    const isArrayPreReq = !name.startsWith("حداقل") && !name.startsWith("گذراندن")
    out.push({
      id: `pre-${id++}`,
      reason: name.startsWith("حداقل")
        ? `برای این درس حداقل باید ${name.split(" ")[1]} واحد پاس کرده باشید. واحد پاس شده شما (${passedUnits})`
        : name.startsWith("گذراندن")
          ? `برای این درس باید ${name} گذرانده باشید`
          : `درس "${name}" به عنوان پیش‌نیاز پاس نشده یا در لیست مردودی نیست`,
      type: "pre_requisites",
      courses,
      preRequisiteName: name,
      isArrayPreReq,
    })
  }
  for (const [name, courses] of coReqMap.entries()) {
    out.push({
      id: `co-${id++}`,
      reason: `درس "${name}" به عنوان هم‌نیاز پاس نشده یا در انتخاب واحد نیست`,
      type: "co_requisites",
      courses,
      coRequisiteName: name,
    })
  }

  return out
}

// Backwards compat: old signature detectConflicts(offerings, moarefNames, isLastTerm?)
export function detectConflictsLegacy(
  notedOfferings: Offering[],
  moarefNames: Set<string>,
  isLastTerm = false
): CourseConflict[] {
  return detectConflicts(notedOfferings, {
    moarefNames,
    chartCourses: [],
    passedNames: new Set(),
    failedNames: new Set(),
    isLastTerm,
  })
}
