"use client"

import { KpiRow } from "@/components/dashboard/kpi-row"
import { ReviewQueueCard } from "@/components/dashboard/review-queue-card"
import { TrendRow } from "@/components/dashboard/trend-row"
import type { DashboardStats } from "@/services/dashboard.service"

/** Real-data dashboard body: KPIs → review queues → trend + distribution. */
export function DashboardInner({ stats }: { stats: DashboardStats }) {
  return (
    <div className="flex flex-col gap-4 p-4 lg:gap-5 lg:p-6">
      <KpiRow stats={stats} />
      <ReviewQueueCard stats={stats} />
      <TrendRow stats={stats} />
    </div>
  )
}
