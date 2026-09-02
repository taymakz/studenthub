"use client"

import { useMemo } from "react"

import type { Offering } from "@/lib/api"

export function useCourseOptions(
  offerings: Offering[],
  termByCourseName: Map<string, number | undefined>
) {
  const professorOptions = useMemo(() => {
    const names: string[] = []
    for (const o of offerings) {
      const raw =
        typeof o.professor === "string"
          ? o.professor
          : (o.professor as { fa?: string } | null)?.fa
      if (raw) names.push(raw)
    }
    return [...new Set(names)]
  }, [offerings])

  const unitOptions = useMemo(() => {
    const s = new Set<number>()
    for (const o of offerings) s.add((o.theoreticalUnits ?? 0) + (o.practicalUnits ?? 0))
    return [...s].sort((a, b) => a - b).map(String)
  }, [offerings])

  const chartTermOptions = useMemo(
    () =>
      [...new Set([...termByCourseName.values()].filter((n): n is number => n != null))].sort(
        (a, b) => a - b
      ),
    [termByCourseName]
  )

  return { professorOptions, unitOptions, chartTermOptions }
}
