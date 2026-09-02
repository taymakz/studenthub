"use client"

import { useState } from "react"

import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import {
  Drawer,
  DrawerPopup,
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
} from "@workspace/ui/components/drawer"
import { GraduationCap } from "lucide-react"

import { totalRequiredUnits, uniqueTerms } from "@/lib/chart"
import { useProfileStore } from "@/stores/profile-store"
import { useProfileChart } from "./use-profile-chart"
import { GraduateSkeleton } from "./section-skeleton"
import { useGraduateSelection } from "./graduate/use-graduate-data"
import { CourseChip, GraduateSummaryCard } from "./graduate/graduate-panels"

export function GraduateProgress() {
  const { pool, isLoading, isError, complete } = useProfileChart()
  const chart = useProfileStore((s) => s.chart)
  const isChartIncomplete = !chart?.isCompleted
  const { selected, toggle, flush, passed } = useGraduateSelection()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)

  const total = totalRequiredUnits(pool)
  const remaining = Math.max(0, total - passed.units)
  const pct = total > 0 ? Math.min(100, Math.max(0, (passed.units / total) * 100)) : 0
  const barMax = 200
  const displayTotal = isChartIncomplete ? "?" : total
  const displayPassed = passed.units
  const displayRemaining = isChartIncomplete ? "؟" : remaining
  const displayPct = isChartIncomplete ? Math.min(100, (displayPassed / barMax) * 100) : pct

  const term = search.trim().toLowerCase()
  const words = term.split(/\s+/)
  const filtered = term ? pool.filter((c) => words.every((w) => c.name.toLowerCase().includes(w))) : pool

  const terms = uniqueTerms(filtered)
  const moaref = filtered.filter((c) => c.isMoaref)
  const unknown = filtered.filter((c) => c.isUnknown)
  const termCourses = (t: number) => filtered.filter((c) => !c.isMoaref && !c.isUnknown && c.termNumber === t)

  if (!complete || isError) return null
  if (isLoading) return <GraduateSkeleton />
  if (total === 0) return null

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) flush(); setOpen(o) }}>
      <DrawerTrigger
        render={<GraduateSummaryCard remaining={remaining} displayRemaining={displayRemaining} displayTotal={displayTotal} displayPassed={displayPassed} displayPct={displayPct} isChartIncomplete={!!isChartIncomplete} onClick={() => setOpen(true)} />}
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>لیست دروس پاس شده</DrawerTitle>
          <DrawerDescription>دروس مورد نظر خود را به عنوان پاس شده علامت بزنید</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-4 p-4">
          <GraduateSummaryCard remaining={remaining} displayRemaining={displayRemaining} displayTotal={displayTotal} displayPassed={displayPassed} displayPct={displayPct} isChartIncomplete={!!isChartIncomplete} />
          <div className="space-y-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو کنید ..." className="h-10 grow text-sm" />
            <p className="text-right text-sm text-muted-foreground">بر اساس نام درس</p>
          </div>
          <GraduateTermLists terms={terms} moaref={moaref} unknown={unknown} termCourses={termCourses} selected={selected} onToggle={toggle} />
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

function GraduateTermLists({
  terms,
  moaref,
  unknown,
  termCourses,
  selected,
  onToggle,
}: {
  terms: number[]
  moaref: import("@/lib/chart").ChartCourseItem[]
  unknown: import("@/lib/chart").ChartCourseItem[]
  termCourses: (t: number) => import("@/lib/chart").ChartCourseItem[]
  selected: string[]
  onToggle: (n: string) => void
}) {
  if (terms.length === 0 && moaref.length === 0 && unknown.length === 0) return <div className="py-10 text-center text-muted-foreground">نتیجه‌ای یافت نشد</div>
  return (
    <div className="flex flex-col gap-4">
      {terms.map((term) => (
        <div key={term} className="flex flex-col gap-2">
          <h3 className="text-center font-medium text-primary">دروس ترم <span className="font-sans">{term}</span></h3>
          <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
            {termCourses(term).map((c) => <CourseChip key={`${term}-${c.name}`} c={c} selected={selected} onToggle={onToggle} />)}
          </div>
        </div>
      ))}
      {moaref.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-center font-medium text-blue-600 dark:text-blue-400">دروس معارف</h3>
          <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">{moaref.map((c) => <CourseChip key={`m-${c.name}`} c={c} selected={selected} onToggle={onToggle} />)}</div>
        </div>
      )}
      {unknown.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-center font-medium text-yellow-600 dark:text-yellow-400">دروس ناشناس</h3>
          <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">{unknown.map((c) => <CourseChip key={`u-${c.name}`} c={c} selected={selected} onToggle={onToggle} />)}</div>
        </div>
      )}
    </div>
  )
}
