"use client"

import { useEffect, type Dispatch, type SetStateAction } from "react"

import { useChart } from "@workspace/ui/components/charts/chart-context"
import type { StatCardHoverState } from "./stat-card-chart"

export type { StatCardHoverState } from "./stat-card-chart"

const monthFmt = new Intl.DateTimeFormat("fa-IR", { month: "short" })
const weekdayFmt = new Intl.DateTimeFormat("fa-IR", { weekday: "long" })

export function formatStatCardMonth(date: Date) {
  return monthFmt.format(date)
}

export function formatStatCardWeekday(date: Date) {
  return weekdayFmt.format(date)
}

function parsePointDate(raw: unknown): Date | null {
  if (raw instanceof Date) {
    return raw
  }
  if (typeof raw === "string") {
    return new Date(raw)
  }
  return null
}

function computePeriodTrend(
  data: Record<string, unknown>[],
  index: number,
  dataKey: string
): number | null {
  if (index <= 0) {
    return null
  }

  const current = data[index]?.[dataKey]
  const previous = data[index - 1]?.[dataKey]

  if (
    typeof current !== "number" ||
    typeof previous !== "number" ||
    previous === 0
  ) {
    return null
  }

  return ((current - previous) / previous) * 100
}

function isSameHoverState(
  a: StatCardHoverState,
  b: StatCardHoverState
): boolean {
  return a.value === b.value && a.label === b.label && a.trend === b.trend
}

/** Syncs hovered chart values, labels, and trend into stat card UI. */
export function StatCardHoverBridge({
  dataKey,
  dateKey = "date",
  formatLabel,
  onHoverChange,
}: {
  dataKey: string
  dateKey?: string
  formatLabel: (date: Date) => string
  onHoverChange: Dispatch<SetStateAction<StatCardHoverState>>
}) {
  const { data, tooltipData } = useChart()

  useEffect(() => {
    let next: StatCardHoverState
    if (!tooltipData?.point) {
      next = { value: null, label: null, trend: null }
    } else {
      const raw = tooltipData.point[dataKey]
      const value = typeof raw === "number" ? raw : null
      const date = parsePointDate(tooltipData.point[dateKey])
      const label = date ? formatLabel(date) : null
      const trend = computePeriodTrend(data, tooltipData.index, dataKey)
      next = { value, label, trend }
    }

    // Bail out when nothing changed — the chart context value is recreated on
    // every render, so unconditional setState here would loop forever.
    onHoverChange((prev) => (isSameHoverState(prev, next) ? prev : next))
  }, [data, dataKey, dateKey, formatLabel, onHoverChange, tooltipData])

  return null
}
