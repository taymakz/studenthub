"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Input } from "@workspace/ui/components/input"
import { Card } from "@workspace/ui/components/card"
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
import { ChevronLeft, GraduationCap } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

import {
  passedUnits as calcPassedUnits,
  totalRequiredUnits,
  uniqueTerms,
  type ChartCourseItem,
} from "@/lib/chart"
import { useProfileStore } from "@/stores/profile-store"
import { useProfileChart } from "./use-profile-chart"
import { GraduateSkeleton } from "./section-skeleton"

function progressTone(pct: number): string {
  if (pct > 80) return "bg-primary"
  if (pct > 60) return "bg-emerald-500"
  if (pct >= 40) return "bg-orange-500"
  if (pct >= 20) return "bg-yellow-500"
  if (pct > 0) return "bg-destructive"
  return "bg-secondary"
}

export function GraduateProgress() {
  const { pool, isLoading, isError, complete } = useProfileChart()
  const chart = useProfileStore((s) => s.chart)
  const isChartIncomplete = !chart?.isCompleted
  const passedList = useProfileStore((s) => s.passed)
  const passedNames = useMemo(
    () => passedList.map((p) => p.courseName),
    [passedList]
  )
  const storeHydrated = useProfileStore((s) => s.hydrated)
  const store = useProfileStore.getState

  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const hydratedRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedRef = useRef(selected)

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    if (!hydratedRef.current && storeHydrated) {
      hydratedRef.current = true
    }
    if (hydratedRef.current) {
      setSelected(passedNames)
    }
  }, [storeHydrated, passedNames])

  const toggle = useCallback(
    (name: string) => {
      const cur = selectedRef.current
      const next = cur.includes(name)
        ? cur.filter((n) => n !== name)
        : [...cur, name]
      setSelected(next)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => store().setPassed(next), 1200)
    },
    [store]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const flush = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    store().setPassed(selectedRef.current)
  }, [store])

  const passed = useMemo(
    () => calcPassedUnits(pool, selected),
    [pool, selected]
  )
  const total = useMemo(() => totalRequiredUnits(pool), [pool])
  const remaining = Math.max(0, total - passed.units)
  const pct =
    total > 0 ? Math.min(100, Math.max(0, (passed.units / total) * 100)) : 0

  // When chart is incomplete show ? / passed and use 200 for bar colors only
  const barMax = 200 // for colors only when incomplete
  const displayTotal = isChartIncomplete ? "?" : total
  const displayPassed = passed.units
  const displayRemaining = isChartIncomplete ? "؟" : remaining
  const displayPct = isChartIncomplete
    ? Math.min(100, (displayPassed / barMax) * 100)
    : pct

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return pool
    const words = term.split(/\s+/)
    return pool.filter((c) =>
      words.every((w) => c.name.toLowerCase().includes(w))
    )
  }, [pool, search])

  const terms = useMemo(() => uniqueTerms(filtered), [filtered])
  const moaref = useMemo(() => filtered.filter((c) => c.isMoaref), [filtered])
  const unknown = useMemo(() => filtered.filter((c) => c.isUnknown), [filtered])
  const termCourses = useCallback(
    (term: number) =>
      filtered.filter(
        (c) => !c.isMoaref && !c.isUnknown && c.termNumber === term
      ),
    [filtered]
  )

  // Skeleton (exact widget height) while data loads; hidden when the profile
  // is incomplete or the chart is missing.
  if (!complete || isError) return null
  if (isLoading) return <GraduateSkeleton />
  if (total === 0) return null

  const CourseChip = ({ c }: { c: ChartCourseItem }) => {
    const isPassed = selected.includes(c.name)
    return (
      <button
        type="button"
        onClick={() => toggle(c.name)}
        className={cn(
          "cursor-pointer rounded-md border px-3 py-2 text-start text-sm font-medium transition-all duration-300",
          isPassed && "border-success/50 bg-success/10 text-success"
        )}
      >
        <p>{c.name}</p>
        <p className="text-muted-foreground">{c.units} واحد</p>
      </button>
    )
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) flush()
        setOpen(o)
      }}
    >
      <DrawerTrigger
        render={
          <button
            type="button"
            className="w-full text-start"
            onClick={() => setOpen(true)}
          >
            <Card className="min-h-[98px] cursor-pointer gap-2.5 p-4 transition-shadow hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="size-5.5 text-muted-foreground" />
                  <p className="text-sm">
                    {!isChartIncomplete && remaining === 0
                      ? "فارغ‌التحصیل شدید!"
                      : `${displayRemaining} واحد تا فارغ‌التحصیلی`}
                  </p>
                  {isChartIncomplete && (
                    <Badge
                      variant="warning"
                      className="px-1.5 py-0 text-[10px]"
                    >
                      چارت ناقص
                    </Badge>
                  )}
                </div>
                <ChevronLeft className="size-3.5 text-muted-foreground" />
              </div>
              <div className="h-1 w-full rounded-full bg-secondary" dir="ltr">
                <div
                  className={cn(
                    "h-1 rounded-full transition-all duration-500",
                    progressTone(displayPct)
                  )}
                  style={{ width: `${displayPct}%` }}
                />
              </div>
              <div className="text-left text-sm text-muted-foreground">
                {displayTotal} / {displayPassed}
              </div>
            </Card>
          </button>
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>لیست دروس پاس شده</DrawerTitle>
          <DrawerDescription>
            دروس مورد نظر خود را به عنوان پاس شده علامت بزنید
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-4 p-4">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-5.5 text-muted-foreground" />
              <p>
                {!isChartIncomplete && remaining === 0
                  ? "فارغ‌التحصیل شدید!"
                  : `${displayRemaining} واحد تا فارغ‌التحصیلی`}
              </p>
              {isChartIncomplete && (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  چارت ناقص
                </Badge>
              )}
            </div>
          </div>
          <div className="h-1 w-full rounded-full bg-secondary" dir="ltr">
            <div
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                progressTone(displayPct)
              )}
              style={{ width: `${displayPct}%` }}
            />
          </div>
          <div className="text-left text-sm text-muted-foreground">
            {displayTotal} / {displayPassed}
          </div>
          <div className="space-y-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو کنید ..."
              className="h-10 grow text-sm"
            />
            <p className="text-right text-sm text-muted-foreground">
              بر اساس نام درس
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {terms.length === 0 &&
            moaref.length === 0 &&
            unknown.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                نتیجه‌ای یافت نشد
              </div>
            ) : (
              <>
                {terms.map((term) => (
                  <div key={term} className="flex flex-col gap-2">
                    <h3 className="text-center font-medium text-primary">
                      دروس ترم <span className="font-sans">{term}</span>
                    </h3>
                    <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
                      {termCourses(term).map((c) => (
                        <CourseChip key={`${term}-${c.name}`} c={c} />
                      ))}
                    </div>
                  </div>
                ))}
                {moaref.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-center font-medium text-blue-600 dark:text-blue-400">
                      دروس معارف
                    </h3>
                    <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
                      {moaref.map((c) => (
                        <CourseChip key={`m-${c.name}`} c={c} />
                      ))}
                    </div>
                  </div>
                )}
                {unknown.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-center font-medium text-yellow-600 dark:text-yellow-400">
                      دروس ناشناس
                    </h3>
                    <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
                      {unknown.map((c) => (
                        <CourseChip key={`u-${c.name}`} c={c} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
