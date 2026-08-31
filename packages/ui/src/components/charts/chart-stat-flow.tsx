"use client"

import NumberFlow from "@number-flow/react"
import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Subset of `Intl.NumberFormatOptions` supported by NumberFlow */
export interface ChartStatFlowFormat {
  notation?: "standard" | "compact"
  compactDisplay?: "short" | "long"
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  minimumIntegerDigits?: number
  minimumSignificantDigits?: number
  maximumSignificantDigits?: number
  style?: "decimal" | "percent" | "currency"
  currency?: string
  currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name"
  unit?: string
  unitDisplay?: "short" | "long" | "narrow"
}

export const defaultChartStatFlowFormat: ChartStatFlowFormat = {
  notation: "standard",
  maximumFractionDigits: 0,
}

export interface ChartStatFlowProps {
  value: number
  label: string
  formatOptions?: ChartStatFlowFormat
  prefix?: string
  suffix?: string
  /** Node rendered inline after the value (e.g. a currency icon). */
  trailing?: ReactNode
  valueClassName?: string
  labelClassName?: string
  icon?: ReactNode
}

/**
 * Shared value + label stack using NumberFlow (same layout as pie / ring centers).
 * Parent should provide flex alignment and sizing when needed.
 *
 * Note: NumberFlow must format with the default locale — fa-IR output makes
 * its digit stacks resolve to NaN. Persian digits come from the Vazirmatn FD
 * font applied to <number-flow-react> in globals.css instead.
 */
export function ChartStatFlow({
  value,
  label,
  formatOptions = defaultChartStatFlowFormat,
  prefix,
  suffix,
  trailing,
  valueClassName = "text-2xl font-bold",
  labelClassName = "text-xs",
  icon,
}: ChartStatFlowProps) {
  return (
    <>
      {icon ? (
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
          {icon}
        </div>
      ) : null}
      <span className={cn("text-foreground tabular-nums", valueClassName)}>
        <NumberFlow
          format={formatOptions}
          isolate
          prefix={prefix}
          suffix={suffix}
          value={value}
          willChange
        />
        {trailing}
      </span>
      <span className={cn("text-chart-label mt-0.5", labelClassName)}>
        {label}
      </span>
    </>
  )
}

ChartStatFlow.displayName = "ChartStatFlow"
