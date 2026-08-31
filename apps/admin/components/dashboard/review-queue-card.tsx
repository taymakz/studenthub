"use client"

import { MessageSquareMore, Send, UploadCloud } from "lucide-react"
import Link from "next/link"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { DashboardStats } from "@/services/dashboard.service"

const faCount = new Intl.NumberFormat("fa-IR")

/** Second dashboard row: queues that need admin review - REAL counters. */
export function ReviewQueueCard({ stats }: { stats: DashboardStats | null }) {
  const items = [
    {
      href: "/uploads",
      title: "آرشیوهای در انتظار بررسی",
      count: stats?.pendingUploads ?? 0,
      icon: UploadCloud,
    },
    {
      href: "/feedback",
      title: "بازخوردهای باز",
      count: stats?.openFeedback ?? 0,
      icon: MessageSquareMore,
    },
    {
      href: "/notifications",
      title: "پیام‌های در صف ارسال",
      count: stats?.pendingMessages ?? 0,
      icon: Send,
    },
  ]

  return (
    <Card className="py-0">
      <CardHeader className="py-3">
        <CardTitle>موارد نیازمند بررسی</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/60 p-3 transition-colors hover:border-ring/60"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background [&_svg]:size-4">
              <item.icon />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {item.title}
            </span>
            <span className="text-base font-semibold tabular-nums">
              {faCount.format(item.count)}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
