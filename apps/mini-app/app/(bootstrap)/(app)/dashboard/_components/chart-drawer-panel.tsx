"use client"

import { Loader2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import type { useChartRequest } from "./use-chart-drawer"

export function ChartLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> در حال بررسی...
    </div>
  )
}

export function ChartUnavailable() {
  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-sm text-destructive">
        چارت در دسترس نیست — فایل PDF این چارت در رجیستری یافت نشد
      </p>
      <Button className="w-full" disabled>
        در دسترس نیست
      </Button>
    </div>
  )
}

export function ChartAvailableAction({
  disabled,
  pending,
  onClick,
}: {
  disabled: boolean
  pending: boolean
  onClick: () => void
}) {
  return (
    <Button className="w-full" disabled={disabled} onClick={onClick}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      دریافت فایل
    </Button>
  )
}

export function ChartError({
  error,
}: {
  error: unknown
}) {
  if (!error) return null
  return (
    <p className="mt-2 text-center text-xs text-destructive">
      {(error as Error)?.message ?? "خطا در ارسال"}
    </p>
  )
}
