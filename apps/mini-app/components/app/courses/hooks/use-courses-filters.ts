"use client"

import { useMemo, useState } from "react"

import type { CoursesFilters } from "../filter-drawer"

export const EMPTY_FILTERS: CoursesFilters = {
  professors: [],
  onlyMoaref: false,
  ignoreMoaref: false,
  showPassed: false,
  onlyCanTake: false,
  units: [],
  chartTerms: [],
  days: [],
}

export function useCoursesFilters() {
  const [filters, setFilters] = useState<CoursesFilters>(EMPTY_FILTERS)

  const filterCount = useMemo(
    () =>
      [
        filters.professors.length > 0,
        filters.onlyMoaref,
        filters.ignoreMoaref,
        filters.showPassed,
        filters.onlyCanTake,
        filters.units.length > 0,
        filters.chartTerms.length > 0,
        filters.days.length > 0,
      ].filter(Boolean).length,
    [filters]
  )

  const clearFilters = () => setFilters(EMPTY_FILTERS)

  return { filters, setFilters, filterCount, clearFilters }
}
