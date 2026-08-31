"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

import {
  CourseSection,
  useRequisiteCandidates,
} from "@/components/course-section"
import { ChartDocImport } from "@/components/chart-doc-import"
import { CoursePickerDialog } from "@/components/course-picker-dialog"
import { toastManager } from "@/components/toast"
import { useChartStore } from "@/components/chart-store"
import { poolToChartCourse } from "@/lib/pool"
import { toFaDigits } from "@/lib/jalali"

/** حالت عادی: the main chart — one full-width section per selected term
    count (ترم ۱..N), same table functionality as معارف but without search.
    Placed courses also leave the نامشخص bucket immediately. */
export function TermChartSections() {
  const {
    pool,
    chart,
    addCoursesToTerm,
    removeCourseFromTerm,
    removeCoursesFromTerm,
    setRequisites,
    removeUnknownMany,
  } = useChartStore()

  const requisiteCandidates = useRequisiteCandidates()

  // A course already placed anywhere outside نامشخص can't be offered again;
  // نامشخص courses stay offerable so they can be picked into a real term.
  const usedOutsideUnknown = React.useMemo(() => {
    const s = new Set<string>()
    chart.moaref.forEach((c) => s.add(c.name))
    for (const courses of Object.values(chart.terms)) {
      courses.forEach((c) => s.add(c.name))
    }
    for (const group of chart.electives) {
      group.courses.forEach((c) => s.add(c.name))
    }
    return s
  }, [chart])

  const availableForTerms = React.useMemo(() => {
    const seen = new Set<string>()
    const out: ReturnType<typeof poolToChartCourse>[] = []
    for (const c of pool.courses) {
      if (usedOutsideUnknown.has(c.name) || seen.has(c.name)) continue
      seen.add(c.name)
      out.push(poolToChartCourse(c))
    }
    return out
  }, [pool.courses, usedOutsideUnknown])

  // One shared picker; which term it targets lives in state.
  const [pickerTerm, setPickerTerm] = React.useState<number | null>(null)
  const [draft, setDraft] = React.useState<string[]>([])

  const openPicker = (term: number) => {
    setDraft([])
    setPickerTerm(term)
  }

  const confirmAddToTerm = () => {
    if (pickerTerm == null) return
    const pickedNames = new Set(draft)
    const picked = availableForTerms.filter((c) => pickedNames.has(c.name))
    if (picked.length === 0) return
    addCoursesToTerm(pickerTerm, picked)
    // Placing a course into a term resolves it out of نامشخص.
    removeUnknownMany(picked.map((c) => c.name))
    toastManager.add({
      type: "success",
      title: `${toFaDigits(picked.length)} درس به ترم ${toFaDigits(pickerTerm)} اضافه شد`,
    })
    // Reset picker state so next open is fresh (query is reset inside the
    // dialog via useEffect, draft is cleared here + on next openPicker).
    setDraft([])
    setPickerTerm(null)
  }

  const terms = Array.from({ length: chart.termCount }, (_, i) => i + 1)

  return (
    <>
      {/* All terms share ONE bg-background surface; the sections themselves
        stay transparent and provide their own padding (hence py-0 here). */}
      <Card className="gap-0 bg-secondary p-2">
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <h3 className="text-base font-medium">دروس ترم‌ها</h3>
          <ChartDocImport scope="terms" withLabel />
        </div>
        {/* Masonry: two independent columns (multicol), cards never split.
          Items flow down each column, so heights don't align per row. */}
        <div className="gap-4 max-lg:flex max-lg:flex-col lg:columns-2">
          {terms.map((term) => (
            <div key={term} className="mb-4 break-inside-avoid">
              <CourseSection
                title={`ترم ${toFaDigits(term)}`}
                emptyLabel="درسی اضافه نشده است."
                courses={chart.terms[term] ?? []}
                headerAction={
                  <Button
                    size="sm"
                    disabled={availableForTerms.length === 0}
                    onClick={() => openPicker(term)}
                  >
                    <PlusIcon /> افزودن درس
                  </Button>
                }
                showRequisites
                candidates={requisiteCandidates}
                onRemove={(index) => removeCourseFromTerm(term, index)}
                onRemoveMany={(names) => removeCoursesFromTerm(term, names)}
                onSetRequisites={(index, kind, values) =>
                  setRequisites(term, index, kind, values)
                }
              />
            </div>
          ))}
        </div>
      </Card>

      <CoursePickerDialog
        open={pickerTerm != null}
        onOpenChange={(open) => {
          if (!open) setPickerTerm(null)
        }}
        title={
          pickerTerm != null
            ? `افزودن درس به ترم ${toFaDigits(pickerTerm)}`
            : ""
        }
        description="فقط درس‌هایی نمایش داده می‌شوند که جای دیگری استفاده نشده‌اند."
        courses={availableForTerms}
        selectedNames={draft}
        onSelectedChange={setDraft}
        onConfirm={confirmAddToTerm}
      />
    </>
  )
}
