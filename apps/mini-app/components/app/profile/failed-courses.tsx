"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Input } from "@workspace/ui/components/input"
import { Card } from "@workspace/ui/components/card"
import {
  Drawer,
  DrawerPopup,
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
} from "@workspace/ui/components/drawer"
import { ChevronLeft, BadgeX } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

import { uniqueTerms, type ChartCourseItem } from "@/lib/chart"
import { useProfileStore } from "@/stores/profile-store"
import { useProfileChart } from "./use-profile-chart"
import { FailedSkeleton } from "./section-skeleton"

export function FailedCourses() {
  const { pool, isLoading, isError, complete } = useProfileChart()
  const failed = useProfileStore((s) => s.failed)
  const passed = useProfileStore((s) => s.passed)
  const failedNames = useMemo(() => failed.map((f) => f.courseName), [failed])
  const passedNames = useMemo(
    () => new Set(passed.map((p) => p.courseName)),
    [passed]
  )
  const store = useProfileStore.getState

  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedRef = useRef(selected)

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    // Keep the local selection in sync with the store so that failed courses added
    // elsewhere (e.g. adding a failed pre-req from the courses conflict drawer) are
    // reflected reactively here — instead of being seeded only once at hydration.


    setSelected(failedNames)
  }, [failedNames])

  const toggle = useCallback(
    (name: string) => {
      const cur = selectedRef.current
      const next = cur.includes(name)
        ? cur.filter((n) => n !== name)
        : [...cur, name]
      setSelected(next)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => store().setFailed(next), 1200)
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
    store().setFailed(selectedRef.current)
  }, [store])

  // Exclude passed courses from the failed pool (like the old widget).
  const failedPool = useMemo(
    () => pool.filter((c) => !passedNames.has(c.name)),
    [pool, passedNames]
  )

  const failedNamesSet = useMemo(() => new Set(selected), [selected])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return failedPool
    const words = term.split(/\s+/)
    return failedPool.filter((c) =>
      words.every((w) => c.name.toLowerCase().includes(w))
    )
  }, [failedPool, search])

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

  if (!complete || isError) return null
  if (isLoading) {
    return <FailedSkeleton />
  }

  const CourseChip = ({ c }: { c: ChartCourseItem }) => {
    const isFailed = failedNamesSet.has(c.name)
    return (
      <button
        type="button"
        onClick={() => toggle(c.name)}
        className={cn(
          "cursor-pointer rounded-md border px-3 py-2 text-start text-sm font-medium transition-all duration-300",
          isFailed && "border-warning bg-warning/10 text-warning"
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
            <Card className="min-h-[84px] cursor-pointer gap-2.5 p-4 transition-shadow hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeX className="size-5.5 text-muted-foreground" />
                  <p className="text-sm">{selected.length} دروس مردود شده</p>
                </div>
                <ChevronLeft className="size-3.5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                دروسی که انتخاب کرده‌اید اما هنوز نمره قبولی نگرفته‌اید
              </p>
            </Card>
          </button>
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>لیست دروس مردود شده</DrawerTitle>
          <DrawerDescription>
            دروس مردود شده خود را برای مدیریت بهتر علامت بزنید
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-4 p-4">
          <div className="space-y-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو کنید ..."
              className="h-10 grow text-sm"
            />
            <p className="text-sm text-muted-foreground">بر اساس نام درس</p>
          </div>

          <div className="flex flex-col gap-4">
            {terms.length === 0 &&
            moaref.length === 0 &&
            unknown.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                {search
                  ? "نتیجه‌ای یافت نشد"
                  : "هیچ درسی برای نمایش وجود ندارد"}
              </div>
            ) : (
              <>
                {terms.map((term) => (
                  <div key={term} className="flex flex-col gap-2">
                    <h3 className="text-center font-medium text-primary">
                      دروس ترم <span className="font-sans text-sm">{term}</span>
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
