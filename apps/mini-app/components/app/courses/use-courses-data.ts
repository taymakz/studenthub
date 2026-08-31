"use client"

import { useCallback, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchMajors, fetchNoted, fetchUniversities } from "@/lib/api"
import { flattenChart } from "@/lib/chart"
import { parseTermCode } from "@/lib/term"

import { useProfileStore } from "@/stores/profile-store"

/**
 * Courses-tab data, read from the app-wide profile store (hydrated from ONE
 * `/me` which returns user, profile, passed/failed/noted, chart, terms and the
 * current نیم سال offerings+diff). Only the display names (university/major)
 * are still fetched separately - everything else is in the store.
 */
export function useCoursesData() {
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
    enabled: Boolean(uni),
  })
  const majorsQuery = useQuery({
    queryKey: ["majors", uni],
    queryFn: async () => (await fetchMajors(uni!)).data.majors,
    enabled: Boolean(uni),
  })
  const uniName = useMemo(
    () => unisQuery.data?.find((u) => u.slug === uni)?.name.fa ?? uni,
    [unisQuery.data, uni]
  )
  const majorEntry = useMemo(
    () => majorsQuery.data?.find((m) => m.slug === major) ?? null,
    [majorsQuery.data, major]
  )
  const majorName = majorEntry?.name.fa ?? major
  const degreeName = majorEntry?.degrees.find((d) => d.slug === profile?.degree)
    ?.name.fa

  const currentTermLabel =
    terms.find((t) => t.termCode === termCode)?.label ?? null
  const scrapedAt = changes?.scrapedAt ?? null

  const newIndexes = useMemo(
    () => new Set((changes?.detail?.added ?? []).map((o) => o.index)),
    [changes]
  )
  const chartPool = useMemo(() => flattenChart(chart), [chart])
  const moarefNames = useMemo(
    () => new Set(chartPool.filter((c) => c.isMoaref).map((c) => c.name)),
    [chartPool]
  )
  const termByCourseName = useMemo(() => {
    const m = new Map<string, number | undefined>()
    for (const c of chartPool) m.set(c.name, c.termNumber)
    return m
  }, [chartPool])

  const chartCourseNames = useMemo(
    () => new Set(chartPool.map((c) => c.name)),
    [chartPool]
  )
  const passedNames = useMemo(
    () => new Set(passed.map((p) => p.courseName)),
    [passed]
  )
  const failedNames = useMemo(
    () => new Set(failed.map((f) => f.courseName)),
    [failed]
  )
  const chartCourses = useMemo(() => {
    if (!chart)
      return [] as Array<{
        name: string
        prerequisites: string[] | number
        corequisites: string[]
      }>
    const out: Array<{
      name: string
      prerequisites: string[] | number
      corequisites: string[]
    }> = []
    for (const courses of Object.values(chart.terms ?? {})) {
      for (const c of courses)
        out.push({
          name: c.name,
          prerequisites: c.prerequisites ?? [],
          corequisites: c.corequisites ?? [],
        })
    }
    for (const c of chart.moaref ?? [])
      out.push({
        name: c.name,
        prerequisites: c.prerequisites ?? [],
        corequisites: c.corequisites ?? [],
      })
    for (const c of chart.unknown ?? [])
      out.push({
        name: c.name,
        prerequisites: c.prerequisites ?? [],
        corequisites: c.corequisites ?? [],
      })
    for (const group of Object.values(chart.electives ?? {})) {
      for (const c of group.courses ?? [])
        out.push({
          name: c.name,
          prerequisites: c.prerequisites ?? [],
          corequisites: c.corequisites ?? [],
        })
    }
    return out
  }, [chart])

  // Instant noted handling — no refetch, just zustand (background sync in store)
  const instantToggleNote = useCallback(
    (courseIndex: string) => store().toggleNote(courseIndex),
    [store]
  )
  const instantTogglePassed = useCallback(
    (courseName: string) => store().togglePassed(courseName),
    [store]
  )
  const instantToggleFailed = useCallback(
    (courseName: string) => store().toggleFailed(courseName),
    [store]
  )

  // Term-specific noted: zustand only (instant UI, background sync in store) — no extra fetch
  const parsedTerm = termCode ? parseTermCode(termCode) : null
  const notedForTerm = useMemo(() => {
    if (!parsedTerm) return []
    return noted.filter(
      (n) =>
        !n.isDeleted &&
        n.year === String(parsedTerm.year) &&
        n.semester === parsedTerm.semester
    )
  }, [noted, parsedTerm])

  const notedIndexes = useMemo(
    () => new Set(notedForTerm.map((n) => n.courseIndex)),
    [notedForTerm]
  )
  const notedOfferings = useMemo(
    () => offerings.filter((o) => notedIndexes.has(o.index)),
    [offerings, notedIndexes]
  )
  const totalNotedUnits = useMemo(
    () =>
      notedOfferings.reduce(
        (s, o) => s + (o.theoreticalUnits ?? 0) + (o.practicalUnits ?? 0),
        0
      ),
    [notedOfferings]
  )

  const canEditNoted = useMemo(() => {
    if (!termCode || terms.length === 0) return false
    const sorted = [...terms].sort((a, b) =>
      b.termCode.localeCompare(a.termCode)
    )
    const lastTwo = new Set(sorted.slice(0, 2).map((t) => t.termCode))
    return lastTwo.has(termCode)
  }, [termCode, terms])

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
