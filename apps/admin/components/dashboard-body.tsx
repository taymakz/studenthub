"use client"

import { DashboardInner } from "@/components/dashboard-inner"
import { DashboardSkeletons } from "@/components/dashboard-skeletons"
import { useDashboardStats } from "@/hooks/use-dashboard"

/** Body only - the PageHeader lives once in the parent route component. */
export function DashboardBody() {
  const { loading, stats, error } = useDashboardStats()

  if (loading && !stats) return <DashboardSkeletons />
  if (loading && stats) return <DashboardInner stats={stats} />

  if (error || !stats) {
    return (
      <p className="p-6 text-sm text-destructive">
        {error ?? "آمار در دسترس نیست"}
      </p>
    )
  }

  return <DashboardInner stats={stats} />
}
