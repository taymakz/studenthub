"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"

/** Fixed-height loading placeholders - charts are excluded on purpose (they
    ship their own shimmer via LineChart status="loading"). */
export function DashboardSkeletons() {
  return (
    <div className="flex flex-col gap-4 p-4 lg:gap-5 lg:p-6">
      {/* Review queue row */}
      <Card className="h-[104px] py-0">
        <CardHeader className="py-3">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[52px] rounded-lg" />
          ))}
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="h-[76px] py-4">
            <CardContent className="flex items-center gap-3 px-4">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-14" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend row has its own LineChart shimmer — no skeleton needed here. */}
    </div>
  )
}
