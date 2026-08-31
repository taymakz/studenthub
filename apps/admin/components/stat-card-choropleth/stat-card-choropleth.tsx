"use client"

import { useState } from "react"

import type { ChoroplethFeature } from "@workspace/ui/components/charts/choropleth"
import {
  ChoroplethChart,
  ChoroplethFeatureComponent,
  ChoroplethTooltip,
} from "@workspace/ui/components/charts/choropleth"
import { ChartStatFlow } from "@workspace/ui/components/charts/chart-stat-flow"
import {
  StatCardChart,
  type StatCardHoverState,
  statCardLabelClassName,
  statCardValueClassName,
} from "@/components/stat-card-kit/stat-card-chart"
import { TrendBadge } from "@/components/stat-card-kit/trend-badge"
import { useWorldDataStandalone } from "@/lib/use-world-data"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { getVisitorColor, getVisitorValue, visitorStats } from "./visitors"
import { StatCardChoroplethHoverBridge } from "./stat-card-choropleth-hover-bridge"

export function StatCardChoropleth() {
  const { worldData, isLoading } = useWorldDataStandalone()
  const [hover, setHover] = useState<StatCardHoverState>({
    value: null,
    label: null,
    trend: null,
  })
  const displayValue = hover.value ?? visitorStats.total
  const displayLabel = hover.label ?? "کل"
  const displayTrend = hover.trend ?? visitorStats.trend

  return (
    <Card className="relative w-full gap-0 overflow-hidden py-0">
      <CardHeader className="pointer-events-none absolute inset-x-0 top-0 z-10 grid auto-rows-min grid-cols-[1fr_auto] items-start gap-1 border-0 bg-gradient-to-b from-card from-45% to-transparent px-4 py-3 pb-10 shadow-none ring-0">
        <div className="flex flex-col gap-0.5">
          <CardTitle>بازدیدکننده یکتا</CardTitle>
          <ChartStatFlow
            label={displayLabel}
            labelClassName={statCardLabelClassName}
            value={displayValue}
            valueClassName={statCardValueClassName}
          />
        </div>
        <CardAction>
          <TrendBadge value={displayTrend} />
        </CardAction>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading || !worldData ? (
          <StatCardChart className="mx-0 mb-0 min-h-[420px]" size="lg">
            <div className="flex h-full min-h-[420px] items-center justify-center text-xs text-muted-foreground">
              در حال بارگذاری نقشه…
            </div>
          </StatCardChart>
        ) : (
          <StatCardChart className="mx-0 mb-0 min-h-[420px]" size="lg">
            <ChoroplethChart
              aspectRatio="2.5 / 1"
              className="min-h-[420px] w-full"
              data={worldData}
            >
              <StatCardChoroplethHoverBridge onHoverChange={setHover} />
              <ChoroplethFeatureComponent
                getFeatureColor={(feature: ChoroplethFeature) =>
                  getVisitorColor(feature)
                }
              />
              <ChoroplethTooltip
                getFeatureValue={getVisitorValue}
                valueLabel="بازدیدکننده"
              />
            </ChoroplethChart>
          </StatCardChart>
        )}
      </CardContent>
    </Card>
  )
}
