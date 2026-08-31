"use client"

import { Badge } from "@workspace/ui/components/badge"

import { PoolImportEmptyState } from "@/components/pool-import"
import { GlobalCourseSections } from "@/components/global-course-sections"
import { TermChartSections } from "@/components/term-chart-sections"
import { useChartStore } from "@/components/chart-store"

/** حالت پیشرفته is deferred: elective groups + advanced constraints land
    later, the normal (عادی) builder is fully functional meanwhile. */
function AdvancedComingSoon() {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border px-8 py-16 text-center">
        <span className="text-base font-semibold">حالت پیشرفته به‌زودی</span>
        <span className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          گروه‌های اختیاری و تنظیمات پیشرفتهٔ چارت در مرحلهٔ بعد ساخته می‌شوند.
          فعلاً از حالت عادی استفاده کنید.
        </span>
        <Badge variant="secondary">به‌زودی</Badge>
      </div>
    </div>
  )
}

/** Content region below the page header: the import empty-state while no
    courses exist, otherwise the main chart (per-term rows in حالت عادی, a
    coming-soon panel in حالت پیشرفته) above the معارف/نامشخص globals. */
export function BuilderContent() {
  const { pool, chart, scope } = useChartStore()

  const hasAnyCourses =
    pool.courses.length > 0 ||
    Object.values(chart.terms).some((courses) => courses.length > 0) ||
    chart.moaref.length > 0 ||
    chart.unknown.length > 0 ||
    chart.electives.length > 0

  if (!hasAnyCourses) {
    return <PoolImportEmptyState />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      {scope.mode === "advanced" ? (
        <AdvancedComingSoon />
      ) : (
        <TermChartSections />
      )}
      <GlobalCourseSections />
    </div>
  )
}
