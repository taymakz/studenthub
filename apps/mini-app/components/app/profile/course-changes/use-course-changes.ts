"use client"

import type { Offering } from "@/lib/api"
import { useProfileChart } from "./../use-profile-chart"
import { useProfileStore } from "@/stores/profile-store"

export function useCourseChangesData() {
  const { pool, complete, isLoading } = useProfileChart()
  const changes = useProfileStore((s) => s.changes)
  const termCode = useProfileStore((s) => s.termCode)

  const chartNames = new Set(pool.map((c) => c.name))
  const hasChart = chartNames.size > 0
  const detail = changes?.detail

  const added = (detail?.added ?? []).filter((o) => (hasChart ? chartNames.has(o.courseName) : true))
  const removed = (detail?.removed ?? []).filter((o) => (hasChart ? chartNames.has(o.courseName) : true))
  const updated = (detail?.updated ?? []).filter((u) => !hasChart || chartNames.has(u.after.courseName))

  return { pool, complete, isLoading, termCode, chartNames, hasChart, detail, added, removed, updated, changes }
}
