"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronLeft, GraduationCap } from "lucide-react"

import type { ChartCourseItem } from "@/lib/chart"

function progressTone(pct: number): string {
  if (pct > 80) return "bg-primary"
  if (pct > 60) return "bg-emerald-500"
  if (pct >= 40) return "bg-orange-500"
  if (pct >= 20) return "bg-yellow-500"
  if (pct > 0) return "bg-destructive"
  return "bg-secondary"
}

export function GraduateSummaryCard({
  remaining,
  displayRemaining,
  displayTotal,
  displayPassed,
  displayPct,
  isChartIncomplete,
  onClick,
}: {
  remaining: number
  displayRemaining: string | number
  displayTotal: string | number
  displayPassed: number
  displayPct: number
  isChartIncomplete: boolean
  onClick?: () => void
}) {
  const content = (
    <Card className="min-h-[98px] cursor-pointer gap-2.5 p-4 transition-shadow hover:shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="size-5.5 text-muted-foreground" />
          <p className="text-sm">{!isChartIncomplete && remaining === 0 ? "فارغ‌التحصیل شدید!" : `${displayRemaining} واحد تا فارغ‌التحصیلی`}</p>
          {isChartIncomplete && <Badge variant="warning" className="px-1.5 py-0 text-[10px]">چارت ناقص</Badge>}
        </div>
        <ChevronLeft className="size-3.5 text-muted-foreground" />
      </div>
      <div className="h-1 w-full rounded-full bg-secondary" dir="ltr">
        <div className={cn("h-1 rounded-full transition-all duration-500", progressTone(displayPct))} style={{ width: `${displayPct}%` }} />
      </div>
      <div className="text-left text-sm text-muted-foreground">{displayTotal} / {displayPassed}</div>
    </Card>
  )
  if (onClick) return <button type="button" className="w-full text-start" onClick={onClick}>{content}</button>
  return content
}

export function CourseChip({ c, selected, onToggle }: { c: ChartCourseItem; selected: string[]; onToggle: (n: string) => void }) {
  const isPassed = selected.includes(c.name)
  return (
    <button type="button" onClick={() => onToggle(c.name)} className={cn("cursor-pointer rounded-md border px-3 py-2 text-start text-sm font-medium transition-all duration-300", isPassed && "border-success/50 bg-success/10 text-success")}>
      <p>{c.name}</p>
      <p className="text-muted-foreground">{c.units} واحد</p>
    </button>
  )
}
