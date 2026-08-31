"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { ArchiveAdd } from "reicon/icons/ArchiveAdd"

import { toastManager } from "@/components/toast"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

import {
  CourseSection,
  useRequisiteCandidates,
} from "@/components/course-section"
import { ChartDocImport } from "@/components/chart-doc-import"
import { CoursePickerDialog } from "@/components/course-picker-dialog"
import { useChartStore } from "@/components/chart-store"
import { poolToChartCourse } from "@/lib/pool"
import { toFaDigits } from "@/lib/jalali"

/** The two term-less groups side by side on large screens (1/2 each). */
export function GlobalCourseSections() {
  const {
    pool,
    chart,
    addMoarefMany,
    removeMoaref,
    removeMoarefMany,
    setMoarefRequisites,
    removeUnknown,
    removeUnknownMany,
    syncAllUnknown,
  } = useChartStore()

  const requisiteCandidates = useRequisiteCandidates()

  // Courses used anywhere EXCEPT unknown are not offerable in معارف again.
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

  const availableForMoaref = React.useMemo(() => {
    const seen = new Set<string>()
    const out: ReturnType<typeof poolToChartCourse>[] = []
    for (const c of pool.courses) {
      if (usedOutsideUnknown.has(c.name) || seen.has(c.name)) continue
      seen.add(c.name)
      out.push(poolToChartCourse(c))
    }
    return out
  }, [pool.courses, usedOutsideUnknown])

  // Add-to-moaref picker state.
  const [addOpen, setAddOpen] = React.useState(false)
  const [addDraft, setAddDraft] = React.useState<string[]>([])

  const openAddPicker = () => {
    setAddDraft([])
    setAddOpen(true)
  }

  const confirmAddMoaref = () => {
    const picked = availableForMoaref.filter((c) => addDraft.includes(c.name))
    if (picked.length === 0) return
    addMoarefMany(picked)
    toastManager.add({
      type: "success",
      title: `${toFaDigits(picked.length)} درس به معارف اضافه شد`,
    })
    setAddDraft([])
    setAddOpen(false)
  }

  const handleSyncAll = () => {
    const before = chart.unknown.length
    syncAllUnknown(pool.courses)
    const after = pool.courses.filter(
      (c) => !usedOutsideUnknown.has(c.name)
    ).length
    toastManager.add({
      type: "success",
      title:
        after > before
          ? `${toFaDigits(after - before)} درس جدید به نامشخص‌ها اضافه شد (${toFaDigits(after)} کل)`
          : `نامشخص‌ها هم‌گام شد (${toFaDigits(after)} درس)`,
    })
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* Each global group gets its own bg-background surface; the section
          inside stays transparent and provides its own padding (py-0). */}
      <Card className="bg-background py-0">
        <CourseSection
          title="معارف"
          emptyLabel="درسی اضافه نشده است."
          courses={chart.moaref}
          searchable
          headerAction={
            <div className="flex items-center gap-2">
              <ChartDocImport scope="moaref" />
              <Button
                size="sm"
                disabled={availableForMoaref.length === 0}
                onClick={openAddPicker}
              >
                <PlusIcon /> افزودن درس
              </Button>
            </div>
          }
          showRequisites
          candidates={requisiteCandidates}
          onRemove={removeMoaref}
          onRemoveMany={removeMoarefMany}
          onSetRequisites={setMoarefRequisites}
        />
      </Card>
      <Card className="bg-background py-0">
        <CourseSection
          title="نامشخص"
          emptyLabel="دکمهٔ افزودن همه را بزنید تا دروس استفاده‌نشده اینجا هم‌گام شوند."
          courses={chart.unknown}
          searchable
          headerAction={
            <Button
              size="sm"
              variant="outline"
              disabled={pool.courses.length === 0}
              onClick={handleSyncAll}
            >
              <span
                aria-hidden="true"
                className="inline-flex [&_svg]:size-4"
                dangerouslySetInnerHTML={{
                  __html: ArchiveAdd.toSvg({ size: 16 }),
                }}
              />
              افزودن همه
            </Button>
          }
          onRemove={removeUnknown}
          onRemoveMany={removeUnknownMany}
        />
      </Card>

      <CoursePickerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="افزودن درس به معارف"
        description="فقط درس‌هایی نمایش داده می‌شوند که جای دیگری استفاده نشده‌اند."
        courses={availableForMoaref}
        selectedNames={addDraft}
        onSelectedChange={setAddDraft}
        onConfirm={confirmAddMoaref}
      />
    </div>
  )
}
