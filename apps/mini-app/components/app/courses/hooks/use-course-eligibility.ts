"use client"

import type { Offering } from "@/lib/api"

export function useCourseEligibility(opts: {
  isChartComplete: boolean
  chartByName: Map<string, unknown>
  passedNames: Set<string>
  failedNames: Set<string>
  notedIndexes: Set<string>
  notedOfferings: Offering[]
}) {
  const { isChartComplete, chartByName, passedNames, failedNames, notedIndexes, notedOfferings } =
    opts

  const passedUnits = [...passedNames].reduce((s) => s + 3, 0)

  const canTake = (offering: Offering) => {
    if (!isChartComplete) return true
    const entry = chartByName.get(offering.courseName) as
      | { prerequisites?: unknown; corequisites?: unknown }
      | undefined
    if (!entry) return true
    const pre = entry.prerequisites
    const co = entry.corequisites
    if (Array.isArray(pre) && pre.length === 1) {
      const req = pre[0] as string
      if (!passedNames.has(req) && !failedNames.has(req)) return false
    }
    if (typeof pre === "number") {
      if (passedUnits < pre) return false
    }
    if (Array.isArray(co) && co.length === 1) {
      const req = co[0] as string
      if (
        !passedNames.has(req) &&
        !notedIndexes.has(offering.index) &&
        !notedOfferings.some((o) => o.courseName === req)
      )
        return false
    }
    return true
  }

  const borderFor = (offering: Offering) => {
    if (!isChartComplete) return ""
    const entry = chartByName.get(offering.courseName) as
      | { prerequisites?: unknown; corequisites?: unknown }
      | undefined
    if (!entry) return ""
    const pre = entry.prerequisites
    const co = entry.corequisites
    if (Array.isArray(pre) && pre.length === 1) {
      const req = pre[0] as string
      if (!passedNames.has(req) && !failedNames.has(req)) return "border-r-4 border-r-destructive"
    }
    if (typeof pre === "number") {
      if (passedUnits < pre) return "border-r-4 border-r-destructive"
    }
    if (Array.isArray(co) && co.length === 1) {
      const req = co[0] as string
      if (!passedNames.has(req) && !notedOfferings.some((o) => o.courseName === req))
        return "border-r-4 border-r-yellow-500"
    }
    return ""
  }

  return { canTake, borderFor, passedUnits }
}
