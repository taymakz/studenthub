"use client"

import { useEffect } from "react"

import { useChoropleth } from "@workspace/ui/components/charts/choropleth"
import type { StatCardHoverState } from "@/components/stat-card-kit/stat-card-chart"
import { computeVisitorTrend, getVisitorValue } from "./visitors"

/** Syncs hovered choropleth feature into stat card NumberFlow and trend badge. */
export function StatCardChoroplethHoverBridge({
  onHoverChange,
}: {
  onHoverChange: (state: StatCardHoverState) => void
}) {
  const { tooltipData } = useChoropleth()

  useEffect(() => {
    if (!tooltipData?.feature) {
      onHoverChange({ value: null, label: null, trend: null })
      return
    }

    const feature = tooltipData.feature
    const label = (feature.properties?.name as string | undefined) ?? "نامشخص"
    const visitors = getVisitorValue(feature)
    const value = visitors ?? 0
    const trend = visitors === undefined ? null : computeVisitorTrend(visitors)

    onHoverChange({ value, label, trend })
  }, [onHoverChange, tooltipData])

  return null
}
