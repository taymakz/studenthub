"use client"

import { useState } from "react"

import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
} from "@workspace/ui/components/drawer"

import type { Offering } from "@/lib/api"
import {
  extractTimes,
  extractWeekday,
} from "@/components/app/profile/schedule-util"
import { CourseActionDrawer } from "./course-action-drawer"
import {
  CourseBadges,
  CourseCardHeader,
  CourseTable,
  type ErrorCourseType,
} from "./sections"
import { ChevronLeft } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { useProfileStore } from "@/stores/profile-store"
import { IsLastTermDrawer } from "@/components/app/settings/is-last-term-drawer"

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
          prerequisites: string[] | number
          corequisites: string[]
          courseName?: string
        }>
        passedNames: Set<string>
        failedNames: Set<string>
        isLastTerm?: boolean
      },
  maybeIsLastTerm = false
): CourseConflict[] {
  let moarefNames: Set<string>
  let chartCourses: Array<{
    name: string
    prerequisites: string[] | number
    corequisites: string[]
    courseName?: string
  }>
  let passedNames: Set<string>
  let failedNames: Set<string>
  let isLastTerm: boolean
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
    } = optsOrMoaref)
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
      const currentTerm = typeof (optsOrMoaref as any)?.termNumber === "number" ? (optsOrMoaref as any).termNumber : null
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

export function ConflictsDrawer({
  open,
  onOpenChange,
  conflicts,
  onToggleNote,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: CourseConflict[]
  onToggleNote: (courseIndex: string) => void
}) {
  const [selected, setSelected] = useState<Offering | null>(null)
  const [lastTermOpen, setLastTermOpen] = useState(false)
  const profile = useProfileStore((s) => s.profile)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerPopup variant="default" showBar>
          <DrawerHeader>
            <DrawerTitle>لیست تداخلات</DrawerTitle>
            <DrawerDescription>
              لیست تداخلات زمانی – معارف – عدم رعایت پیش‌نیاز و هم‌نیاز
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-6 p-4">
            {conflicts.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                تداخلی وجود ندارد
              </p>
            ) : (
              conflicts.map((group, index) => (
                <div
                  key={group.id}
                  className="space-y-6 rounded-lg border border-warning p-4"
                >
                  <p className="text-center text-sm font-medium text-warning">
                    {index + 1} - {group.reason}
                  </p>
                  {group.type === "moaref" &&
                    group.courses.length === 2 &&
                    !profile?.isLastTerm && (
                      <div className="space-y-2">
                        <p className="text-center text-xs text-muted-foreground">
                          آیا ترم آخر هستید؟
                        </p>
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => setLastTermOpen(true)}
                        >
                          انتخاب ترم آخر
                        </Button>
                      </div>
                    )}
                  {group.courses.map((o) => (
                    <ConflictCard
                      key={o.index}
                      offering={o}
                      errorType={group.type}
                      onSelected={setSelected}
                    />
                  ))}
                </div>
              ))
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      <CourseActionDrawer
        offering={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onDelete={(index) => {
          onToggleNote(index)
          setSelected(null)
        }}
        conflictGroups={conflicts}
        isLastTerm={profile?.isLastTerm ?? false}
      />

      <IsLastTermDrawer
        open={lastTermOpen}
        onOpenChange={setLastTermOpen}
        hideTrigger
      />
    </>
  )
}

function ConflictCard({
  offering,
  errorType,
  onSelected,
}: {
  offering: Offering
  errorType: ErrorCourseType
  onSelected: (o: Offering) => void
}) {
  return (
    <div
      className="relative cursor-pointer rounded-md border bg-card px-4 pt-8 pb-4 text-sm"
      onClick={() => onSelected(offering)}
    >
      <CourseBadges isNoted={false} isPassed={false} />
      <div className="mb-2">
        <CourseCardHeader offering={offering} isNew={false} />
      </div>
      <div className="mb-2">
        <CourseTable
          offering={offering}
          hideCopy
          hideCourseCode
          hideClassCode
          errorType={errorType}
        />
      </div>
      <div className="flex items-center justify-center gap-1 py-2 text-muted-foreground">
        <span className="text-xs">عملیات</span>
        <ChevronLeft className="size-3.5" />
      </div>
    </div>
  )
}
