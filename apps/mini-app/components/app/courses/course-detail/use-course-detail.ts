"use client"

import { useEffect, useMemo } from "react"
import { usePathname } from "next/navigation"

import type { Offering } from "@/lib/api"
import { professorName } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"

export function useCourseDetailClose(open: boolean, onOpenChange: (o: boolean) => void, studentsOpen: boolean, setStudentsOpen: (v: boolean) => void) {
  const pathname = usePathname()
  useEffect(() => {
    if (open) onOpenChange(false)
    if (studentsOpen) setStudentsOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
}

export function useCourseDetailDerived(offering: Offering | null) {
  const allOfferings = useProfileStore((s) => s.offerings)
  const termCode = useProfileStore((s) => s.termCode)
  const terms = useProfileStore((s) => s.terms)
  const chart = useProfileStore((s) => s.chart)
  const passed = useProfileStore((s) => s.passed)
  const failed = useProfileStore((s) => s.failed)

  const canEditNoted = useMemo(() => {
    if (!termCode || terms.length === 0) return false
    const sorted = [...terms].sort((a, b) => b.termCode.localeCompare(a.termCode))
    return new Set(sorted.slice(0, 2).map((t) => t.termCode)).has(termCode)
  }, [termCode, terms])

  const otherProfessors = useMemo(
    () => allOfferings.filter((x) => x.courseName === offering?.courseName && professorName(x) !== professorName(offering as Offering)),
    [allOfferings, offering]
  )

  const passedNames = useMemo(() => new Set(passed.map((p) => p.courseName)), [passed])
  const failedNames = useMemo(() => new Set(failed.map((f) => f.courseName)), [failed])

  const chartCourse = useMemo(() => {
    if (!chart || !offering) return null
    const all = [
      ...Object.values(chart.terms ?? {}).flat(),
      ...(chart.moaref ?? []),
      ...(chart.unknown ?? []),
      ...Object.values(chart.electives ?? {}).flatMap((g: unknown) => (g as { courses?: unknown[] }).courses ?? []),
    ] as Record<string, unknown>[]
    return all.find((c) => (c as { name: string }).name === offering.courseName) ?? null
  }, [chart, offering])

  return { canEditNoted, otherProfessors, passedNames, failedNames, chartCourse, chart }
}
