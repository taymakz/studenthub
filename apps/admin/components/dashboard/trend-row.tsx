import { ChannelsRingCard } from "@/components/dashboard/channels-ring-card"
import { RevenueTrendCard } from "@/components/dashboard/revenue-trend-card"
import type { DashboardStats } from "@/services/dashboard.service"

/** Trend row: signup hero (۲/۳) + university user share ring (۱/۳). */
export function TrendRow({ stats }: { stats: DashboardStats | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <RevenueTrendCard signup={stats?.signupSeries ?? null} />
      </div>
      <ChannelsRingCard universities={stats?.usersByUniversity ?? null} />
    </div>
  )
}
