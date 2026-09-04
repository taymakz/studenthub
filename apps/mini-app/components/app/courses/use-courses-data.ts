"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchMajors, fetchNoted, fetchUniversities } from "@/lib/api"
import { flattenChart } from "@/lib/chart"
import { parseTermCode } from "@/lib/term"

import { useProfileStore } from "@/stores/profile-store"
import { useIsRoutePreview } from "@/lib/route-preview-context"

type ChartRequisiteCourse = {
  name: string
  prerequisites: string[] | number
  corequisites: string[]
}

/** Flattens every chart bucket (terms/moaref/unknown/electives) into one
    prerequisite-relevant list. Module-scope: keeps branchy derivation out of
    the React hook. */
function collectChartCourses(
  chart: ReturnType<typeof useProfileStore.getState>["chart"]
): ChartRequisiteCourse[] {
  const out: ChartRequisiteCourse[] = []
  if (!chart) return out
  const push = (c: {
    name: string
    prerequisites?: unknown
    corequisites?: unknown
  }) =>
    out.push({
      name: c.name,
      prerequisites: (c.prerequisites as string[] | number) ?? [],
      corequisites: (c.corequisites as string[]) ?? [],
    })
  for (const courses of Object.values(chart.terms ?? {})) {
    for (const c of courses) push(c)
  }
  for (const c of chart.moaref ?? []) push(c)
  for (const c of chart.unknown ?? []) push(c)
  for (const group of Object.values(chart.electives ?? {})) {
    for (const c of group.courses ?? []) push(c)
  }
  return out
}

/** Noted rows belonging to the given نیم سال term code. */
function notedForTermCode(
  noted: ReturnType<typeof useProfileStore.getState>["noted"],
  termCode: string | null
) {
  const parsedTerm = termCode ? parseTermCode(termCode) : null
  if (!parsedTerm) return []
  return noted.filter(
    (n) =>
      !n.isDeleted &&
      n.year === String(parsedTerm.year) &&
      n.semester === parsedTerm.semester
  )
}

/** Noting is only allowed on the two most recent نیم سال terms. */
function canEditTermNoted(
  termCode: string | null,
  terms: ReturnType<typeof useProfileStore.getState>["terms"]
): boolean {
  if (!termCode || terms.length === 0) return false
  const sorted = terms.toSorted((a, b) => b.termCode.localeCompare(a.termCode))
  const lastTwo = new Set(sorted.slice(0, 2).map((t) => t.termCode))
  return lastTwo.has(termCode)
}

/**
 * Courses-tab data, read from the app-wide profile store (hydrated from ONE
 * `/me` which returns user, profile, passed/failed/noted, chart, terms and the
 * current نیم سال offerings+diff). Only the display names (university/major)
 * are still fetched separately - everything else is in the store.
 */
export function useCoursesData() {
  const isRoutePreview = useIsRoutePreview()
  const profile = useProfileStore((s) => s.profile)
  const offerings = useProfileStore((s) => s.offerings)
  const noted = useProfileStore((s) => s.noted)
  const passed = useProfileStore((s) => s.passed)
  const failed = useProfileStore((s) => s.failed)
  const terms = useProfileStore((s) => s.terms)
  const termCode = useProfileStore((s) => s.termCode)
  const chart = useProfileStore((s) => s.chart)
  const changes = useProfileStore((s) => s.changes)
  const hydrated = useProfileStore((s) => s.hydrated)
  const loading = useProfileStore((s) => s.loading)
  const store = useProfileStore.getState
  const qc = useQueryClient()

  const uni = profile?.universitySlug
  const major = profile?.majorSlug
  const complete = Boolean(uni && major && termCode)

  const unisQuery = useQuery({
    queryKey: ["universities"],
    queryFn: async () => (await fetchUniversities()).data.universities,
    enabled: !isRoutePreview && Boolean(uni),
  })
  const majorsQuery = useQuery({
    queryKey: ["majors", uni],
    queryFn: async () => (await fetchMajors(uni!)).data.majors,
    enabled: !isRoutePreview && Boolean(uni),
  })
  const uniName = unisQuery.data?.find((u) => u.slug === uni)?.name.fa ?? uni
  const majorEntry = majorsQuery.data?.find((m) => m.slug === major) ?? null
  const majorName = majorEntry?.name.fa ?? major
  const degreeName = majorEntry?.degrees.find((d) => d.slug === profile?.degree)
    ?.name.fa

  const currentTermLabel =
    terms.find((t) => t.termCode === termCode)?.label ?? null
  const scrapedAt = changes?.scrapedAt ?? null

  const newIndexes = new Set((changes?.detail?.added ?? []).map((o) => o.index))
  const chartPool = flattenChart(chart)
  const moarefNames = new Set<string>()
  for (const c of chartPool) {
    if (c.isMoaref) moarefNames.add(c.name)
  }
  const termByCourseName = new Map<string, number | undefined>()
  for (const c of chartPool) termByCourseName.set(c.name, c.termNumber)

  const chartCourseNames = new Set(chartPool.map((c) => c.name))
  const passedNames = new Set(passed.map((p) => p.courseName))
  const failedNames = new Set(failed.map((f) => f.courseName))
  const chartCourses = collectChartCourses(chart)

  // Instant noted handling — no refetch, just zustand (background sync in store)
  const instantToggleNote = (courseIndex: string) => store().toggleNote(courseIndex)
  const instantTogglePassed = (courseName: string) => store().togglePassed(courseName)
  const instantToggleFailed = (courseName: string) => store().toggleFailed(courseName)

  // Term-specific noted: zustand only (instant UI, background sync in store) — no extra fetch
  const notedForTerm = notedForTermCode(noted, termCode)

  const notedIndexes = new Set(notedForTerm.map((n) => n.courseIndex))
  const notedOfferings = offerings.filter((o) => notedIndexes.has(o.index))
  const totalNotedUnits = notedOfferings.reduce(
    (s, o) => s + (o.theoreticalUnits ?? 0) + (o.practicalUnits ?? 0),
    0
  )

  const canEditNoted = canEditTermNoted(termCode, terms)

  return {
    profile,
    complete,
    uniName,
    majorName,
    degreeName,
    currentTermLabel,
    terms,
    termCode,
    canEditNoted,
    setSemester: (code: string) => {
      store().setSemester(code)
      // prefetch noted for new term
      qc.invalidateQueries({ queryKey: ["noted", code] })
    },
    semesterPending: loading,
    offerings,
    scrapedAt,
    newIndexes,
    notedCount: notedForTerm.length,
    notedIndexes,
    notedOfferings,
    totalNotedUnits,
    moarefNames,
    termByCourseName,
    chartCourseNames,
    chartCourses,
    passedNames,
    failedNames,
    chart,
    toggleNote: instantToggleNote,
    togglePassed: instantTogglePassed,
    toggleFailed: instantToggleFailed,
    addAllToPassed: () => {
      const latest = useProfileStore.getState()
      const allNames = [
        ...new Set([
          ...latest.passed.map((p) => p.courseName),
          ...notedOfferings.map((o) => o.courseName),
        ]),
      ]
      latest.setPassed(allNames)
    },
    clearNoted: () => {
      for (const n of notedForTerm) store().toggleNote(n.courseIndex)
    },
    isLoading: !hydrated || loading,
  }
}
