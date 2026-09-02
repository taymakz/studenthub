"use client"

import { useMemo } from "react"

import { extractWeekday, normalizeDay } from "@/components/app/profile/schedule-util"
import type { Offering } from "@/lib/api"
import type { CoursesFilters } from "../filter-drawer"

export function useFilteredCourses(opts: {
  offerings: Offering[]
  chartCourseNames: Set<string>
  search: string
  filters: CoursesFilters
  moarefNames: Set<string>
  passedNames: Set<string>
  termByCourseName: Map<string, number | undefined>
  isChartComplete: boolean
  canTake: (o: Offering) => boolean
}) {
  const {
    offerings,
    chartCourseNames,
    search,
    filters,
    moarefNames,
    passedNames,
    termByCourseName,
    isChartComplete,
    canTake,
  } = opts

  const totalMatching = useMemo(
    () => offerings.filter((o) => chartCourseNames.has(o.courseName)).length,
    [offerings, chartCourseNames]
  )

  const filtered = useMemo(() => {
    let list = offerings.filter((o) => chartCourseNames.has(o.courseName))
    const term = search.trim().toLowerCase()
    const words = term.split(/\s+/)
    if (filters.onlyMoaref) list = list.filter((o) => moarefNames.has(o.courseName))
    if (filters.ignoreMoaref) list = list.filter((o) => !moarefNames.has(o.courseName))
    if (!filters.showPassed) list = list.filter((o) => !passedNames.has(o.courseName))
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
        filters.units.includes(String((o.theoreticalUnits ?? 0) + (o.practicalUnits ?? 0)))
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
    if (filters.onlyCanTake && isChartComplete) list = list.filter((o) => canTake(o))
    if (term)
      list = list.filter((o) => {
        const prof =
          typeof o.professor === "string"
            ? o.professor
            : ((o.professor as { fa?: string } | null)?.fa ?? "")
        return words.every((w) =>
          `${o.courseName} ${prof} ${o.courseCode} ${o.classSchedule ?? ""}`.toLowerCase().includes(w)
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
    isChartComplete,
    canTake,
  ])

  return { filtered, totalMatching }
}
