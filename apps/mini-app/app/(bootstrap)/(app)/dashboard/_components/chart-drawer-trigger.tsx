"use client"

import { Workflow } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"

const triggerClassName = "flex items-center flex-col gap-3.5 text-center w-full"

export function ChartDrawerTrigger({
  isLoading,
  isUnavailable,
}: {
  isLoading: boolean
  isUnavailable: boolean
}) {
  return (
    <button className={triggerClassName}>
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
