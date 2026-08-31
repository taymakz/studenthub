"use client"

import { GraduationCap, Star, UserCheck, Users } from "lucide-react"

import { Card, CardContent } from "@workspace/ui/components/card"
import { toFa } from "@/lib/format"
import type { DashboardStats } from "@/services/dashboard.service"

/** First dashboard row: four real counters from /admin/stats. */
export function KpiRow({ stats }: { stats: DashboardStats | null }) {
  const items = [
    {
      label: "کاربران",
      value: stats?.users,
      icon: Users,
      tone: "text-chart-1",
    },
    {
      label: "مشارکت‌کنندگان",
      value: stats?.contributors,
      icon: UserCheck,
      tone: "text-chart-2",
    },
    {
      label: "رأی‌های اساتید",
      value: stats?.professorVotes,
      icon: Star,
      tone: "text-chart-3",
    },
    {
      label: "دروس انتخابی فعال",
      value: stats?.activeNotedCourses,
      icon: GraduationCap,
      tone: "text-chart-4",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary ${item.tone}`}
            >
              <item.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs text-muted-foreground">
                {item.label}
              </span>
              <span className="block text-xl font-semibold tabular-nums">
                {item.value === undefined ? "…" : toFa(item.value)}
              </span>
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
