"use client"

import { useState } from "react"

import ContentLayout from "@/components/app/content-layout"
import { useCoursesData } from "@/components/app/courses/use-courses-data"
import { ConflictsDrawer } from "@/components/app/courses/conflicts"
import { CourseDetailDrawer } from "@/components/app/courses/course-detail-drawer"
import { FloatingButtons } from "@/components/app/courses/floating-buttons"
import { NotedDrawer } from "@/components/app/courses/noted-drawer"
import { ProfessorDrawer } from "@/components/app/courses/professor-drawer"
import { FilterDrawer } from "@/components/app/courses/filter-drawer"
import { ViewModeDrawer } from "@/components/app/courses/view-mode-drawer"

import { useCoursesFilters } from "@/components/app/courses/hooks/use-courses-filters"
import { useCourseOptions } from "@/components/app/courses/hooks/use-course-options"
import { useChartByName } from "@/components/app/courses/hooks/use-chart-by-name"
import { useCourseEligibility } from "@/components/app/courses/hooks/use-course-eligibility"
import { useFilteredCourses } from "@/components/app/courses/hooks/use-filtered-courses"
import { useCoursesConflicts } from "@/components/app/courses/hooks/use-courses-conflicts"
import { CoursesContent } from "@/components/app/courses/courses-content"
import { CoursesToolbar } from "@/components/app/courses/courses-toolbar"
import { useTimeAgo } from "@/hooks/use-time-ago"
import type { Offering } from "@/lib/api"

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
  } = d as typeof d & { terms: import("@/lib/api").OfferingTerm[]; canEditNoted: boolean }

  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<"full" | "simple">("full")
  const [notedViewMode, setNotedViewMode] = useState<"full" | "simple">("full")
  const [filterOpen, setFilterOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [notedOpen, setNotedOpen] = useState(false)
  const [conflictsOpen, setConflictsOpen] = useState(false)
  const [professor, setProfessor] = useState<{ name: string; uni: string; major: string } | null>(null)
  const [selected, setSelected] = useState<Offering | null>(null)
  const [semesterPickerOpen, setSemesterPickerOpen] = useState(false)

  const chart = (d as { chart: import("@/lib/api").MyChart | null }).chart
  const chartCourses = (d as { chartCourses: Array<{ name: string; prerequisites: string[] | number; corequisites: string[] }> }).chartCourses
  const failedNames = (d as { failedNames: Set<string> }).failedNames ?? new Set<string>()

  const { filters, setFilters, filterCount } = useCoursesFilters()
  const { professorOptions, unitOptions, chartTermOptions } = useCourseOptions(offerings, termByCourseName)
  const chartByName = useChartByName(chart)
  const isChartComplete = chart?.isCompleted === true
  const { canTake, borderFor } = useCourseEligibility({
    isChartComplete,
    chartByName,
    passedNames,
    failedNames,
    notedIndexes,
    notedOfferings,
  })
  const { filtered, totalMatching } = useFilteredCourses({
    offerings,
    chartCourseNames,
    search,
    filters,
    moarefNames,
    passedNames,
    termByCourseName,
    isChartComplete,
    canTake,
  })
  const conflicts = useCoursesConflicts({
    notedOfferings,
    moarefNames,
    chartCourses: (chartCourses ?? []) as Array<{ name: string; prerequisites: string[] | number; corequisites: string[] }>,
    passedNames,
    failedNames,
    isLastTerm: profile?.isLastTerm ?? false,
    termNumber: profile?.termNumber ?? null,
  })

  const lastUpdated = useTimeAgo(scrapedAt ? Date.parse(scrapedAt) : null)
  const profileLine = [uniName, majorName, currentTermLabel].filter(Boolean).join(" · ")

  return (
    <>
      <CoursesToolbar
        search={search}
        onSearchChange={setSearch}
        filterCount={filterCount}
        resultCount={filtered.length}
        onOpenFilter={() => setFilterOpen(true)}
        onOpenViewMode={() => setViewOpen(true)}
        termCode={termCode}
        terms={terms}
        profileLine={profileLine}
        semesterPickerOpen={semesterPickerOpen}
        onSemesterPickerOpenChange={setSemesterPickerOpen}
      />

      <ContentLayout>
        <CoursesContent
          isLoading={isLoading}
          complete={complete}
          termCode={termCode}
          offeringsLength={offerings.length}
          filtered={filtered}
          filterCount={filterCount}
          search={search}
          totalMatching={totalMatching}
          lastUpdated={lastUpdated}
          notedIndexes={notedIndexes}
          passedNames={passedNames}
          newIndexes={newIndexes}
          viewMode={viewMode}
          borderFor={borderFor}
          onSelect={setSelected}
          onClearFilters={() => {
            setSearch("")
            setFilters({
              professors: [],
              onlyMoaref: false,
              ignoreMoaref: false,
              showPassed: false,
              onlyCanTake: false,
              units: [],
              chartTerms: [],
              days: [],
            })
          }}
        />
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
      <ConflictsDrawer open={conflictsOpen} onOpenChange={setConflictsOpen} conflicts={conflicts} onToggleNote={toggleNote} />
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
        options={{ professors: professorOptions, units: unitOptions, chartTerms: chartTermOptions }}
        resultLength={filtered.length}
        isChartComplete={isChartComplete}
      />
      <ViewModeDrawer open={viewOpen} onOpenChange={setViewOpen} viewMode={viewMode} onViewModeChange={setViewMode} />
    </>
  )
}
