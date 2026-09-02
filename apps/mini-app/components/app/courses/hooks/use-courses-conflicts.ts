"use client"

import type { Offering } from "@/lib/api"

import { detectConflicts } from "../conflict-detect"

export function useCoursesConflicts(opts: {
  notedOfferings: Offering[]
  moarefNames: Set<string>
  chartCourses: Array<{ name: string; prerequisites: string[] | number; corequisites: string[] }>
  passedNames: Set<string>
  failedNames: Set<string>
  isLastTerm: boolean
  termNumber: number | null
}) {
  const { notedOfferings, moarefNames, chartCourses, passedNames, failedNames, isLastTerm, termNumber } =
    opts

  return detectConflicts(notedOfferings, {
    moarefNames,
    chartCourses: chartCourses ?? [],
    passedNames,
    failedNames: failedNames ?? new Set<string>(),
    isLastTerm: isLastTerm ?? false,
    termNumber: termNumber ?? null,
  })
}
