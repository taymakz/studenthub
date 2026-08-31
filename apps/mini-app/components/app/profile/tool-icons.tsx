"use client"

import type { ComponentType } from "react"
import {
  CalendarDays,
  CalendarSearch3,
  Calculator2,
  CrownStar,
} from "reicon-react"

/**
 * reicon-react icons are plain React components - wrap each ONCE at module
 * scope so the tool buttons keep a stable identity (no remount on re-render).
 */
function makeIcon(
  Icon: ComponentType<{
    className?: string
    size?: number
    weight?: "Filled" | "Outline"
  }>
) {
  return function ToolIcon({
    className,
    size = 24,
  }: {
    className?: string
    size?: number
  }) {
    return <Icon className={className} size={size} weight="Filled" />
  }
}

export const CalendarWeekIcon = makeIcon(CalendarDays)
export const CalendarExamIcon = makeIcon(CalendarSearch3)
export const CalculatorGradeIcon = makeIcon(Calculator2)
export const CrownStarIcon = makeIcon(CrownStar)
