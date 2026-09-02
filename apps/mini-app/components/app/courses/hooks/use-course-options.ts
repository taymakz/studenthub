"use client"

import type { Offering } from "@/lib/api"

export function useCourseOptions(
  offerings: Offering[],
  termByCourseName: Map<string, number | undefined>
) {
  const names: string[] = []
  for (const o of offerings) {
    const raw =
      typeof o.professor === "string"
        ? o.professor
        : (o.professor as { fa?: string } | null)?.fa
    if (raw) names.push(raw)
  }
  const professorOptions = [...new Set(names)]

  const unitSet = new Set<number>()
  for (const o of offerings) unitSet.add((o.theoreticalUnits ?? 0) + (o.practicalUnits ?? 0))
  const unitOptions = [...unitSet].sort((a, b) => a - b).map(String)

  const chartTermOptions = [...new Set([...termByCourseName.values()].filter((n): n is number => n != null))].sort(
    (a, b) => a - b
  )

  return { professorOptions, unitOptions, chartTermOptions }
}
