"use client"

import dynamic from "next/dynamic"
import { useState } from "react"

import { curveMonotoneX } from "@visx/curve"

import { Grid } from "@workspace/ui/components/charts/grid"
import { Line } from "@workspace/ui/components/charts/line"
import { ChartStatFlow } from "@workspace/ui/components/charts/chart-stat-flow"

const LineChart = dynamic(
  () =>
    import("@workspace/ui/components/charts/line-chart").then(
      (m) => m.LineChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[240px] animate-pulse rounded-lg bg-muted/50" />
    ),
  }
)
import {
  statCardLabelClassName,
  type StatCardHoverState,
} from "@/components/stat-card-kit/stat-card-chart"
import { StatCardHoverBridge } from "@/components/stat-card-kit/stat-card-hover-bridge"
import { TrendBadge } from "@/components/stat-card-kit/trend-badge"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { formatDate } from "@/lib/persian-date"
import type { SignupSeries } from "@/services/dashboard.service"

// Identical geometry to the working KPI cards — fixed-height full-bleed box.
const CHART_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 }

function toSeriesPoints(series: SignupSeries["series"]) {
  return series.map((p) => ({ date: new Date(p.date), value: p.value }))
}

/** Hero chart: signups per month from 2025-01 till current month (dynamic). */
export function RevenueTrendCard({ signup }: { signup: SignupSeries | null }) {
  const [hover, setHover] = useState<StatCardHoverState>({
    value: null,
    label: null,
    trend: null,
  })
  const [loadingStyle] = useState<"pulse" | "sweep">("pulse")

  const series = signup ? toSeriesPoints(signup.series) : []
  const status = series.length > 0 ? "ready" : "loading"
  const displayValue = hover.value ?? signup?.average ?? 0
  const displayLabel = hover.label ?? "میانگین ماهانه"
  const displayTrend = hover.trend ?? signup?.trend ?? 0

  return (
    <Card className="h-[320px] w-full gap-0 py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle>روند عضویت کاربران</CardTitle>
        <CardAction>
          <TrendBadge value={displayTrend} />
        </CardAction>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-2 pb-3">
        {status === "ready" ? (
          <div className="flex items-center justify-between">
            <ChartStatFlow
              formatOptions={{ maximumFractionDigits: 1 }}
              label={displayLabel}
              labelClassName={statCardLabelClassName}
              value={displayValue}
              valueClassName="text-3xl font-semibold leading-none tracking-tight"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="flex h-[52px] items-center justify-between"
          >
            <div className="h-9 w-40" />
            <div className="h-4 w-16" />
          </div>
        )}

        <div className="relative -mx-4 min-h-0 flex-1 overflow-hidden [&_.relative.w-full]:aspect-auto! [&_.relative.w-full]:h-full!">
          <LineChart
            className="h-full w-full"
            data={series}
            loadingLabel="در حال بارگذاری روند عضویت…"
            margin={CHART_MARGIN}
            status={status}
            yDomainTween
          >
            <StatCardHoverBridge
              dataKey="value"
              formatLabel={(d: Date) =>
                formatDate(d, "MMMM yyyy", {
                  calendarType: "shamsi",
                  locale: "fa",
                })
              }
              onHoverChange={setHover}
            />
            <Grid
              horizontal
              loadingStroke="color-mix(in oklch, var(--chart-grid) 50%, transparent)"
              shimmer
              shimmerSync
              stroke="var(--chart-grid)"
            />
            <Line
              curve={curveMonotoneX}
              dataKey="value"
              fadeEdges
              loadingStroke="var(--foreground)"
              loadingStrokeOpacity={0.5}
              loadingStyle={loadingStyle}
              showHighlight
              stroke="var(--chart-line-primary)"
              strokeWidth={2}
            />
          </LineChart>
        </div>
      </CardContent>
    </Card>
  )
}
