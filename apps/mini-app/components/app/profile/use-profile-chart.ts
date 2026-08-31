"use client"

import { useMemo } from "react"

import { useProfileStore } from "@/stores/profile-store"
import { flattenChart, type ChartCourseItem } from "@/lib/chart"
import { isProfileComplete as completeCheck, type MeProfile } from "@/lib/api"

export function isProfileComplete(profile: MeProfile | null): boolean {
  return completeCheck(profile)
}

/**
 * The student's profile + the flattened graduation-chart course pool that the
 * graduate-progress and failed-courses widgets share. Reads the app-wide
 * profile store (hydrated from /me/bootstrap) so both widgets stay consistent.
 */
export function useProfileChart() {
  const profile = useProfileStore((s) => s.profile)
  const chart = useProfileStore((s) => s.chart)
  const hydrated = useProfileStore((s) => s.hydrated)
  const loading = useProfileStore((s) => s.loading)
  const error = useProfileStore((s) => s.error)
  const complete = isProfileComplete(profile)

  const pool = useMemo(() => flattenChart(chart), [chart]) as ChartCourseItem[]

  return {
    profile,
    complete,
    pool,
    isLoading: !hydrated || loading,
    isError: error,
  }
}
