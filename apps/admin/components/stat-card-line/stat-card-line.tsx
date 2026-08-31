"use client"

import { useState, type ReactNode } from "react"

import { curveBasis } from "@visx/curve"

import { ChartStatFlow } from "@workspace/ui/components/charts/chart-stat-flow"
import { Grid } from "@workspace/ui/components/charts/grid"
import { Line } from "@workspace/ui/components/charts/line"
import { LineChart } from "@workspace/ui/components/charts/line-chart"
import type { SeriesPoint } from "@/lib/random-metrics"
import {
  StatCardHoverState,
  statCardLabelClassName,
} from "@/components/stat-card-kit/stat-card-chart"
import {
  formatStatCardMonth,
  formatStatCardWeekday,
  StatCardHoverBridge,
} from "@/components/stat-card-kit/stat-card-hover-bridge"
import { TrendBadge } from "@/components/stat-card-kit/trend-badge"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

/** Shape-valid stand-in data so the loading pulse has geometry to draw over. */
const FALLBACK_SERIES: SeriesPoint[] = [
  { date: new Date(2024, 0, 1), value: 40 },
  { date: new Date(2024, 0, 2), value: 55 },
  { date: new Date(2024, 0, 3), value: 47 },
  { date: new Date(2024, 0, 4), value: 62 },
  { date: new Date(2024, 0, 5), value: 58 },
  { date: new Date(2024, 0, 6), value: 71 },
  { date: new Date(2024, 0, 7), value: 66 },
]

// Stable object identities — inline literals restart chart animations each render.
const CHART_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 }

/** Compact KPI card: title + trend badge, line sparkline with value below it. */
export function StatCardLineKpi({
  title,
  unit,
  series,
  average,
  trend,
  pending,
  color = "var(--chart-1)",
  suffix,
  trailing,
  labelFormat = "weekday",
  maximumFractionDigits = 0,
  loadingLabel,
}: {
  title: string
  /** Optional currency/unit note rendered beside the title, e.g. «تومان». */
  unit?: string
  series: SeriesPoint[]
  average: number
  trend: number
  pending: boolean
  color?: string
  suffix?: string
  trailing?: ReactNode
  labelFormat?: "month" | "weekday"
  maximumFractionDigits?: number
  loadingLabel?: string
}) {
  const [hover, setHover] = useState<StatCardHoverState>({
    value: null,
    label: null,
    trend: null,
  })
  const round = (value: number) => Number(value.toFixed(maximumFractionDigits))
  const displayValue =
    hover.value === null ? round(average) : round(hover.value)
  const displayLabel = hover.label ?? "میانگین"
  const displayTrend = hover.trend ?? trend
  const formatLabel =
    labelFormat === "month" ? formatStatCardMonth : formatStatCardWeekday

  return (
    <Card className="h-[200px] w-full gap-0 py-0">
      <CardHeader className="px-4 py-2">
        <CardTitle className="text-xs text-muted-foreground">
          {title}
          {unit ? <span className="text-xs"> ({unit})</span> : null}
        </CardTitle>
        <CardAction>
          {pending ? (
            <div className="h-6 w-14" aria-hidden />
          ) : (
            <TrendBadge value={displayTrend} />
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-1 px-4 pt-4 pb-2">
        <div className="relative -mx-4 h-20 overflow-hidden [&_.relative.w-full]:aspect-auto! [&_.relative.w-full]:h-full!">
          <LineChart
            aspectRatio="2.5 / 1"
            className="w-full"
            data={pending ? FALLBACK_SERIES : series}
            loadingLabel={loadingLabel}
            margin={CHART_MARGIN}
            status={pending ? "loading" : "ready"}
            yDomainTween={false}
          >
            <StatCardHoverBridge
              dataKey="value"
              formatLabel={formatLabel}
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
              curve={curveBasis}
              dataKey="value"
              fadeEdges
              loadingStroke="var(--foreground)"
              loadingStrokeOpacity={0.5}
              loadingStyle="pulse"
              showHighlight
              stroke={color}
              strokeWidth={2}
            />
          </LineChart>
        </div>

        {pending ? (
          <div
            className="flex h-[52px] items-center justify-between"
            aria-hidden
          >
            <div className="h-6 w-28" />
            <div className="h-4 w-16" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <ChartStatFlow
              formatOptions={{ maximumFractionDigits }}
              label={displayLabel}
              labelClassName={statCardLabelClassName}
              suffix={suffix}
              trailing={trailing}
              value={displayValue}
              valueClassName="text-2xl font-semibold leading-none tracking-tight"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
