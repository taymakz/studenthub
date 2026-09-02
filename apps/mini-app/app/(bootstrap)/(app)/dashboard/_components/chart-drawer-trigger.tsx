"use client"

import { Workflow } from "lucide-react"
import type * as React from "react"

import { Badge } from "@workspace/ui/components/badge"

const triggerClassName = "flex items-center flex-col gap-3.5 text-center w-full"

/**
 * Renders a REAL <button> (Base UI triggers need native button semantics) and
 * spreads ALL received props onto it — that spread is how DrawerTrigger's
 * click/dismiss handlers reach this component (same pattern as SettingsRow).
 */
export function ChartDrawerTrigger({
  isLoading,
  isUnavailable,
  ...props
}: {
  isLoading: boolean
  isUnavailable: boolean
} & React.ComponentProps<"button">) {
  return (
    <button type="button" className={triggerClassName} {...props}>
      <div className="relative mx-auto flex aspect-square max-h-32 w-full max-w-32 items-center justify-center rounded-lg border bg-card">
        <Workflow className="size-8 text-lime-500" />
        {!isLoading && isUnavailable && (
          <Badge
            variant="destructive"
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0 text-[10px]"
          >
            در دسترس نیست
          </Badge>
        )}
      </div>
      <div className="w-full text-sm">چارت درسی</div>
    </button>
  )
}
