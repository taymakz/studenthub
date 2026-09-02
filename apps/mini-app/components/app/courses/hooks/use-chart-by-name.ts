"use client"

import { useMemo } from "react"

import type { MyChart } from "@/lib/api"

export function useChartByName(chart: MyChart | null | undefined) {
  return useMemo(() => {
    const m = new Map<string, unknown>()
    if (!chart) return m
    for (const courses of Object.values(chart.terms ?? {}))
      for (const c of courses as unknown[]) m.set((c as { name: string }).name, c)
    for (const c of (chart.moaref ?? []) as unknown[]) m.set((c as { name: string }).name, c)
    for (const c of (chart.unknown ?? []) as unknown[]) m.set((c as { name: string }).name, c)
    for (const g of Object.values(chart.electives ?? {}))
      for (const c of ((g as { courses?: unknown[] }).courses ?? []) as unknown[])
        m.set((c as { name: string }).name, c)
    return m
  }, [chart])
}
