"use client"

import { Badge } from "@workspace/ui/components/badge"

import { PoolImportEmptyState } from "@/components/pool-import"
import { GlobalCourseSections } from "@/components/global-course-sections"
import { TermChartSections } from "@/components/term-chart-sections"
import { useChartStore } from "@/components/chart-store"
import { parsePoolInput } from "@/lib/pool"
import { toFaDigits } from "@/lib/jalali"
import { toastManager } from "@/components/toast"

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
  const { setPool } = useChartStore()

  const hasAnyCourses =
    pool.courses.length > 0 ||
    Object.values(chart.terms).some((courses) => courses.length > 0) ||
    chart.moaref.length > 0 ||
    chart.unknown.length > 0 ||
    chart.electives.length > 0

  // After the first import, keep listening for Ctrl+V to merge additional pastes
  React.useEffect(() => {
    if (!hasAnyCourses) return
    function onPaste(event: ClipboardEvent) {
      const text = event.clipboardData?.getData("text") ?? ""
      const trimmed = text.trim()
      if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return
      const result = parsePoolInput(trimmed)
      if (result.error || result.courses.length === 0) return
      event.preventDefault()
      const existing = new Set(pool.courses.map((c) => `${c.code}|${c.name}`))
      const fresh = result.courses.filter((c) => !existing.has(`${c.code}|${c.name}`))
      if (fresh.length === 0) {
        toastManager.add({ type: "info", title: "درس جدیدی یافت نشد" })
        return
      }
      setPool({
        courses: [...pool.courses, ...fresh],
        totalOfferings: pool.totalOfferings + result.totalOfferings,
      })
      toastManager.add({
        type: "success",
        title: `${toFaDigits(fresh.length)} درس جدید اضافه شد — اکنون ${toFaDigits(pool.courses.length + fresh.length)} درس از ${toFaDigits(pool.totalOfferings + result.totalOfferings)} ارائه`,
      })
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [hasAnyCourses, pool, setPool])

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
