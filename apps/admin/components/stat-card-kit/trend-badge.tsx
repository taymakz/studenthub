"use client"

import { ArrowDown, ArrowUp } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { faPercent } from "@/lib/format"
import { cn } from "@workspace/ui/lib/utils"

export function TrendBadge({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const positive = value >= 0

  return (
    <Badge
      className={cn(
        positive &&
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        className
      )}
      variant={positive ? "outline" : "destructive"}
    >
      {positive ? (
        <ArrowUp className="size-3" />
      ) : (
        <ArrowDown className="size-3" />
      )}
      {positive ? "+" : ""}
      {faPercent(Math.abs(value))}
    </Badge>
  )
}
