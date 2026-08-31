"use client"

import { useMemo, useState } from "react"
import { Virtuoso } from "react-virtuoso"
import { GitFork, Send } from "lucide-react"

import ContentLayout from "@/components/app/content-layout"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerDescription,
} from "@workspace/ui/components/drawer"
import { cn } from "@workspace/ui/lib/utils"
import { findNewerSemesterCode, SEMESTER_FA } from "@/lib/term"
import { SemesterDrawer } from "@/components/app/semester-drawer"

import { useCoursesData } from "@/components/app/courses/use-courses-data"
import { CoursesHeader } from "@/components/app/courses/courses-header"
import { CourseCard } from "@/components/app/courses/course-card"
import { CourseDetailDrawer } from "@/components/app/courses/course-detail-drawer"
import { NotedDrawer } from "@/components/app/courses/noted-drawer"
import {
  ConflictsDrawer,
  detectConflicts,
} from "@/components/app/courses/conflicts"
import { FloatingButtons } from "@/components/app/courses/floating-buttons"
import { ProfessorDrawer } from "@/components/app/courses/professor-drawer"
import {
  FilterDrawer,
  type CoursesFilters,
} from "@/components/app/courses/filter-drawer"
import { ViewModeDrawer } from "@/components/app/courses/view-mode-drawer"
import { GITHUB_REPO_URL } from "@/constants"
import { useTimeAgo } from "@/hooks/use-time-ago"
import type { Offering } from "@/lib/api"
import {
  extractWeekday,
  normalizeDay,
} from "@/components/app/profile/schedule-util"
import { BookOpen } from "reicon-react"
const EMPTY_FILTERS: CoursesFilters = {
  professors: [],
  onlyMoaref: false,
  ignoreMoaref: false,
  showPassed: false,
  onlyCanTake: false,
  units: [],
  chartTerms: [],
  days: [],
}

export default function CoursesPage() {
  const d = useCoursesData()
  const {
    complete,
    termCode,
    offerings,
    chartCourseNames,
    scrapedAt,
    newIndexes,
    notedCount,
    notedIndexes,
    notedOfferings,
    totalNotedUnits,
    moarefNames,
    termByCourseName,
    passedNames,
    toggleNote,
    togglePassed,
    addAllToPassed,
    clearNoted,
    profile,
    isLoading,
    uniName,
    majorName,
    currentTermLabel,
    terms,
    canEditNoted,
  } = d as typeof d & {
    terms: import("@/lib/api").OfferingTerm[]
    canEditNoted: boolean
  }

  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<"full" | "simple">("full")
  const [notedViewMode, setNotedViewMode] = useState<"full" | "simple">("full")
  const [filters, setFilters] = useState<CoursesFilters>(EMPTY_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [notedOpen, setNotedOpen] = useState(false)
  const [conflictsOpen, setConflictsOpen] = useState(false)
  const [professor, setProfessor] = useState<{
    name: string
    uni: string
    major: string
  } | null>(null)
  const [selected, setSelected] = useState<Offering | null>(null)
  const [semesterPickerOpen, setSemesterPickerOpen] = useState(false)

  const conflicts = useMemo(
    () =>
      detectConflicts(notedOfferings, {
        moarefNames,
        chartCourses: (d as any).chartCourses ?? [],
        passedNames,
        failedNames: (d as any).failedNames ?? new Set(),
        isLastTerm: profile?.isLastTerm ?? false,
      }),
    [
      notedOfferings,
      moarefNames,
      (d as any).chartCourses,
      passedNames,
      (d as any).failedNames,
      profile?.isLastTerm,
    ]
  )

  const professorOptions = useMemo(() => {
    const names = offerings
      .map((o) =>
        typeof o.professor === "string"
          ? o.professor
          : (o.professor as { fa?: string } | null)?.fa
      )
      .filter(Boolean) as string[]
    return [...new Set(names)]
  }, [offerings])
  const unitOptions = useMemo(() => {
    const s = new Set<number>()
    for (const o of offerings)
      s.add((o.theoreticalUnits ?? 0) + (o.practicalUnits ?? 0))
    return [...s].sort((a, b) => a - b).map(String)
  }, [offerings])
  const chartTermOptions = useMemo(
    () =>
      [
        ...new Set(
          [...termByCourseName.values()].filter((n): n is number => n != null)
        ),
      ].sort((a, b) => a - b),
    [termByCourseName]
  )

  const chartByName = useMemo(() => {
    const m = new Map<string, any>()
    const chart = (d as any).chart as import("@/lib/api").MyChart | null
    if (!chart) return m
    for (const courses of Object.values(chart.terms ?? {}))
      for (const c of courses as any[]) m.set(c.name, c)
    for (const c of (chart.moaref ?? []) as any[]) m.set(c.name, c)
    for (const c of (chart.unknown ?? []) as any[]) m.set(c.name, c)
    for (const g of Object.values(chart.electives ?? {}))
      for (const c of (g as any).courses ?? []) m.set(c.name, c)
    return m
  }, [(d as any).chart])
  const isChartComplete = (d as any).chart?.isCompleted === true
  const canTake = (offering: Offering) => {
    if (!isChartComplete) return true
    const entry: any = chartByName.get(offering.courseName)
    if (!entry) return true
    const pre = entry.prerequisites
    const co = entry.corequisites
    // single prerequisite
    if (Array.isArray(pre) && pre.length === 1) {
      const req = pre[0] as string
      if (
        !passedNames.has(req) &&
        !((d as any).failedNames as Set<string>)?.has(req)
      )
        return false
    }
    if (typeof pre === "number") {
      const passedUnits = [...passedNames].reduce((s, n) => s + 3, 0)
      if (passedUnits < pre) return false
    }
    if (Array.isArray(co) && co.length === 1) {
      const req = co[0] as string
      if (
        !passedNames.has(req) &&
        !notedIndexes.has(offering.index) &&
        !notedOfferings.some((o) => o.courseName === req)
      ) {
        // Actually for coreq single, need to check if co-req is not passed and not noted
        // For border, if single co-req not satisfied, show yellow
        return false
      }
    }
    return true
  }
  const borderFor = (offering: Offering) => {
    if (!isChartComplete) return ""
    const entry: any = chartByName.get(offering.courseName)
    if (!entry) return ""
    const pre = entry.prerequisites
    const co = entry.corequisites
    if (Array.isArray(pre) && pre.length === 1) {
      const req = pre[0] as string
      if (
        !passedNames.has(req) &&
        !((d as any).failedNames as Set<string>)?.has(req)
      )
        return "border-r-4 border-r-destructive"
    }
    if (typeof pre === "number") {
      const passedUnits = [...passedNames].reduce((s, n) => s + 3, 0)
      if (passedUnits < pre) return "border-r-4 border-r-destructive"
    }
    if (Array.isArray(co) && co.length === 1) {
      const req = co[0] as string
      if (
        !passedNames.has(req) &&
        !notedOfferings.some((o) => o.courseName === req)
      )
        return "border-r-4 border-r-yellow-500"
    }
    return ""
  }

  // Total offerings that belong to the student's chart (before any user
  // filters like passed/search). This is the “دروس ارائه شده تا الان” count
  // and must match the profile's “جدید/تغییر” baseline — both filter by the
  // same chartCourseNames set. The picker/list below may further hide passed
  // courses, moaref, etc., but the header stays stable.
  const totalMatching = useMemo(
    () => offerings.filter((o) => chartCourseNames.has(o.courseName)).length,
    [offerings, chartCourseNames]
  )

  const filtered = useMemo(() => {
    let list = offerings.filter((o) => chartCourseNames.has(o.courseName))
    const term = search.trim().toLowerCase()
    const words = term.split(/\s+/)
    if (filters.onlyMoaref)
      list = list.filter((o) => moarefNames.has(o.courseName))
    if (filters.ignoreMoaref)
      list = list.filter((o) => !moarefNames.has(o.courseName))
    if (!filters.showPassed)
      list = list.filter((o) => !passedNames.has(o.courseName))
    if (filters.professors.length)
      list = list.filter((o) => {
        const name =
          typeof o.professor === "string"
            ? o.professor
            : (o.professor as { fa?: string } | null)?.fa
        return name && filters.professors.includes(name)
      })
    if (filters.units.length)
      list = list.filter((o) =>
        filters.units.includes(
          String((o.theoreticalUnits ?? 0) + (o.practicalUnits ?? 0))
        )
      )
    if (filters.chartTerms.length)
      list = list.filter((o) => {
        const t = termByCourseName.get(o.courseName)
        return t != null && filters.chartTerms.includes(t)
      })
    if (filters.days.length)
      list = list.filter((o) => {
        const day = extractWeekday(o.classSchedule)
        return day && filters.days.some((d) => normalizeDay(d) === day)
      })
    if (filters.onlyCanTake && isChartComplete)
      list = list.filter((o) => canTake(o))
    if (term)
      list = list.filter((o) => {
        const prof =
          typeof o.professor === "string"
            ? o.professor
            : ((o.professor as { fa?: string } | null)?.fa ?? "")
        return words.every((w) =>
          `${o.courseName} ${prof} ${o.courseCode} ${o.classSchedule ?? ""}`
            .toLowerCase()
            .includes(w)
        )
      })
    return list
  }, [
    offerings,
    search,
    filters,
    moarefNames,
    passedNames,
    termByCourseName,
    chartCourseNames,
  ])

  const filterCount = [
    filters.professors.length > 0,
    filters.onlyMoaref,
    filters.ignoreMoaref,
    filters.showPassed,
    filters.onlyCanTake,
    filters.units.length > 0,
    filters.chartTerms.length > 0,
    filters.days.length > 0,
  ].filter(Boolean).length

  const openLink = (url: string) => {
    try {
      window.open(url, "_blank")
    } catch {
      /* noop */
    }
  }
  const lastUpdated = useTimeAgo(scrapedAt ? Date.parse(scrapedAt) : null)

  const profileLine = [uniName, majorName, currentTermLabel]
    .filter(Boolean)
    .join(" · ")
  const newerCode = findNewerSemesterCode(
    termCode,
    terms.map((t: { termCode: string }) => t.termCode)
  )
  const hasNewTerm = Boolean(newerCode && newerCode !== termCode)

  return (
    <>
      <CoursesHeader
        search={search}
        onSearchChange={setSearch}
        filterCount={filterCount}
        resultCount={filtered.length}
        onOpenFilter={() => setFilterOpen(true)}
        onOpenViewMode={() => setViewOpen(true)}
      />

      <ContentLayout>
        <button
          type="button"
          onClick={() => setSemesterPickerOpen(true)}
          className="flex w-full cursor-pointer flex-wrap items-center justify-center gap-1 bg-muted/50 py-1.5 text-center text-xs text-muted-foreground"
        >
          {hasNewTerm && (
            <span className="inline-flex items-center text-[10px] leading-none text-warning">
              نیم سال جدید اضافه شد ·
            </span>
          )}
          <span className="tabular-nums">
            {termCode
              ? `${termCode} ${SEMESTER_FA[terms.find((t) => t.termCode === termCode)?.semester as keyof typeof SEMESTER_FA] ?? ""} دروس نیمسال`.trim()
              : profileLine || "پروفایل دانشگاهی"}
          </span>
        </button>

        <SemesterDrawer
          open={semesterPickerOpen}
          onOpenChange={setSemesterPickerOpen}
        />

        <div className="container mx-auto space-y-3 px-4 pt-5">
          <div className="flex justify-between text-sm text-muted-foreground">
            <p>دروس ارائه شده تا الان: {totalMatching}</p>
            <p>آخرین بروزرسانی {lastUpdated}</p>
          </div>

          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-md" />
              ))}
            </div>
          ) : !complete || !termCode ? (
            <EmptyState
              title="پروفایل ناقص"
              text="برای دیدن دروس، ابتدا پروفایل دانشگاهی خود را تکمیل کنید."
            />
          ) : offerings.length === 0 ? (
            <EmptyState
              title="هیچ درسی موجود نیست"
              text="برای این ورودی درسی ثبت نشده است. در تکمیل رجیستری مشارکت کنید یا به ما اطلاع دهید."
              actions={
                <>
                  <Button
                    variant="outline"
                    onClick={() => openLink(GITHUB_REPO_URL)}
                  >
                    <GitFork className="size-4" />
                    مشارکت در گیت‌هاب
                  </Button>
                  <Button
                    onClick={() => openLink("https://t.me/studenthubir?direct")}
                  >
                    <Send className="size-4" />
                    ارتباط با پشتیبانی
                  </Button>
                </>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="نتیجه‌ای یافت نشد"
              text="جستجو یا فیلترها را تغییر دهید."
              actions={
                filterCount > 0 || search.trim().length > 0 ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("")
                      setFilters(EMPTY_FILTERS)
                    }}
                  >
                    پاک کردن فیلترها
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Virtuoso
              useWindowScroll
              data={filtered}
              computeItemKey={(_, o) => o.index}
              overscan={6}
              itemContent={(index, o) => (
                <div
                  className="animate-fadeIn py-1.5"
                  style={{
                    animationDelay: `${Math.min(index * 30, 300)}ms`,
                    animationFillMode: "backwards",
                  }}
                >
                  <CourseCard
                    offering={o}
                    isNoted={notedIndexes.has(o.index)}
                    isPassed={passedNames.has(o.courseName)}
                    isNew={newIndexes.has(o.index)}
                    viewMode={viewMode}
                    onSelect={setSelected}
                    className={borderFor(o)}
                  />
                </div>
              )}
            />
          )}
        </div>
      </ContentLayout>

      <FloatingButtons
        notedCount={notedCount}
        conflictsCount={conflicts.length}
        onOpenNoted={() => setNotedOpen(true)}
        onOpenConflicts={() => setConflictsOpen(true)}
      />

      <NotedDrawer
        open={notedOpen}
        onOpenChange={setNotedOpen}
        notedOfferings={notedOfferings}
        totalUnits={totalNotedUnits}
        viewMode={notedViewMode}
        onViewModeChange={setNotedViewMode}
        onToggleNote={toggleNote}
        onAddAllToPassed={addAllToPassed}
        onClearNoted={clearNoted}
      />
      <ConflictsDrawer
        open={conflictsOpen}
        onOpenChange={setConflictsOpen}
        conflicts={conflicts}
        onToggleNote={toggleNote}
      />
      <CourseDetailDrawer
        offering={selected}
        isNoted={selected ? notedIndexes.has(selected.index) : false}
        isPassed={selected ? passedNames.has(selected.courseName) : false}
        isNew={selected ? newIndexes.has(selected.index) : false}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onToggleNote={toggleNote}
        onTogglePassed={togglePassed}
        onOpenProfessor={(name) => {
          // Always open drawer — previous project did, guard prevented click from doing nothing when profile missing
          const uni = profile?.universitySlug ?? ""
          const major = profile?.majorSlug ?? ""
          setProfessor({ name, uni, major })
        }}
        onSelectCourse={(course) => setSelected(course)}
      />
      <ProfessorDrawer
        open={!!professor}
        onOpenChange={(open) => !open && setProfessor(null)}
        professorName={professor?.name ?? ""}
        uni={professor?.uni ?? ""}
        major={professor?.major ?? ""}
        currentCourseIndex={selected?.index ?? null}
        onCourseSelected={(course) => {
          setProfessor(null)
          setSelected(course)
        }}
      />
      <FilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onChange={setFilters}
        options={{
          professors: professorOptions,
          units: unitOptions,
          chartTerms: chartTermOptions,
        }}
        resultLength={filtered.length}
        isChartComplete={isChartComplete}
      />
      <ViewModeDrawer
        open={viewOpen}
        onOpenChange={setViewOpen}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </>
  )
}

function EmptyState({
  title,
  text,
  actions,
}: {
  title: string
  text: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <BookOpen className="size-9" weight="Filled" />

      <p className="text-lg font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
    </div>
  )
}
