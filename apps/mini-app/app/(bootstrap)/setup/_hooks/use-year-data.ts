"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchChartYearDirs } from "@/lib/api"

export function useYearData(universitySlug: string | undefined, majorSlug: string | undefined, degree: string | undefined) {
  const yearDirsQuery = useQuery({
    queryKey: ["chart-year-dirs", universitySlug, majorSlug, degree],
    queryFn: async () => {
      const res = await fetchChartYearDirs(universitySlug!, majorSlug!, degree!)
      const seen = new Set<string>()
      const dirs: Array<{ dirName: string; semesters: string[] }> = []
      for (const c of res.data.charts) {
        if (!seen.has(c.yearDir)) {
          seen.add(c.yearDir)
          dirs.push({ dirName: c.yearDir, semesters: c.semesters })
        }
      }
      return dirs.sort((a, b) => b.dirName.localeCompare(a.dirName))
    },
    enabled: Boolean(universitySlug) && Boolean(majorSlug) && Boolean(degree),
  })

  const yearOptions: Array<{ range: string; label: string }> = []
  for (const d of yearDirsQuery.data ?? []) {
    const match = /^\[(\d{4})-(\d{4})\]$/.exec(d.dirName)
    if (match) yearOptions.push({ range: d.dirName, label: `${match[1]} تا ${match[2]}` })
    else if (/^\d{4}$/.test(d.dirName)) yearOptions.push({ range: d.dirName, label: d.dirName })
  }

  return { yearDirsQuery, yearOptions }
}

export function useAvailableSemesters(
  yearDirs: Array<{ dirName: string; semesters: string[] }> | undefined,
  entryYearRange: string | undefined
) {
  const chosen = yearDirs?.find((d) => d.dirName === entryYearRange)
  if (!chosen) return [] as Array<"MEHR" | "BAHMAN" | "SUMMER">
  const sems = new Set<"MEHR" | "BAHMAN" | "SUMMER">()
  for (const s of chosen.semesters) {
    if (s === "MEHR" || s === "BAHMAN") {
      sems.add("MEHR")
      sems.add("BAHMAN")
    } else if (s === "SUMMER") {
      sems.add("SUMMER")
    }
  }
  return [...sems]
}
