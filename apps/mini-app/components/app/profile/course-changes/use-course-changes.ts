"use client"

import { useMemo } from "react"

import type { Offering } from "@/lib/api"
import { useProfileChart } from "./../use-profile-chart"
import { useProfileStore } from "@/stores/profile-store"

export function useCourseChangesData() {
  const { pool, complete, isLoading } = useProfileChart()
  const changes = useProfileStore((s) => s.changes)
  const termCode = useProfileStore((s) => s.termCode)

  const chartNames = useMemo(() => new Set(pool.map((c) => c.name)), [pool])
  const hasChart = chartNames.size > 0
  const detail = changes?.detail

  const added = useMemo(
    () => (detail?.added ?? []).filter((o) => (hasChart ? chartNames.has(o.courseName) : true)),
    [detail, hasChart, chartNames]
  )
  const removed = useMemo(
    () => (detail?.removed ?? []).filter((o) => (hasChart ? chartNames.has(o.courseName) : true)),
    [detail, hasChart, chartNames]
  )
  const updated = useMemo(
    () => (detail?.updated ?? []).filter((u) => !hasChart || chartNames.has(u.after.courseName)),
    [detail, hasChart, chartNames]
  )

  return { pool, complete, isLoading, termCode, chartNames, hasChart, detail, added, removed, updated, changes }
}
