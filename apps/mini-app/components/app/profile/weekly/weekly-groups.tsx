"use client"

import { ChevronLeft } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { professorName } from "@/lib/api"
import { extractTimes } from "./../schedule-util"
import type { Offering } from "@/lib/api"

const DAY_ORDER = ["شنبه","یکشنبه","دوشنبه","سه شنبه","چهارشنبه","پنج شنبه","جمعه"]

export function WeeklyGroups({
  groups,
  onSelect,
  readOnly = false,
}: {
  groups: { day: string; items: Offering[] }[]
  onSelect?: (o: Offering) => void
  /** Friend view: same UI without chevron or tap handling. */
  readOnly?: boolean
}) {
  return (
    <>
      {DAY_ORDER.filter((day) => groups.some((g) => g.day === day)).map((day) => {
        const items = groups.find((g) => g.day === day)?.items ?? []
        return (
          <div key={day} className="space-y-2">
            <h3 className="font-semibold text-success">{day}</h3>
            <div className="space-y-2.5">
              {items.map((o) => {
                const times = extractTimes(o.classSchedule)
                const body = (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1"><p className="line-clamp-1">{o.courseName}</p></div>{!readOnly && <ChevronLeft className="size-4 min-w-fit text-muted-foreground" />}</div>
                    <div className="flex items-center justify-between text-xs"><p className="text-muted-foreground">{professorName(o) ?? "استادی ثبت نشده"}</p>{times.length > 0 && <div className="font-medium text-info">از {times[0]} تا {times[1]}</div>}</div>
                    {o.location && <p className="text-xs text-muted-foreground">{o.location}</p>}
                  </>
                )
                return readOnly ? (
                  <div key={o.index} className="relative w-full space-y-2 rounded-lg border bg-card px-4 pt-6 pb-4 text-sm">{body}</div>
                ) : (
                  <button type="button" key={o.index} className={cn("relative w-full cursor-pointer space-y-2 rounded-lg border bg-card px-4 pt-6 pb-4 text-start text-sm")} onClick={() => onSelect?.(o)}>{body}</button>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
