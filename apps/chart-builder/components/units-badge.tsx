"use client"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

import { toFaDigits } from "@/lib/jalali"

/** Units badge color scale: ۰/۰٫۵/۱ gray, ۲ info-blue, ۳ success-green,
    ≥۴ red. */
export function UnitsBadge({ units }: { units: number }) {
  let tone: string
  if (units >= 4) {
    tone =
      "border-transparent bg-red-500/10 font-medium text-red-600 dark:text-red-400"
  } else if (units === 3) {
    tone = "border-transparent bg-success/10 font-medium text-success"
  } else if (units === 2) {
    tone = "border-transparent bg-info/10 font-medium text-info"
  } else {
    tone = "text-muted-foreground/60"
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "min-w-7 shrink-0 justify-center text-center tabular-nums",
        tone
      )}
    >
      {toFaDigits(units).replace(".", "٫")}
    </Badge>
  )
}
