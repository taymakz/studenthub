"use client"

import { ChevronLeft } from "lucide-react"
import type { Offering } from "@/lib/api"
import { professorName } from "@/lib/api"
import { extractTimes, formatDaysRemainInPersian, formatPersianDateLong, getCurrentDatePersian, persianDateDiff, persianWeekDayFromDays } from "./../schedule-util"

function daysRemaining(date: string): number | null {
  if (date === "تاریخ نامشخص") return null
  try { return persianDateDiff(getCurrentDatePersian(), date) } catch { return null }
}

export function ExamGroups({ groups, onSelect }: { groups: { date: string; items: Offering[] }[]; onSelect: (o: Offering) => void }) {
  return (
    <>
      {groups.map(({ date, items }) => {
        const remaining = daysRemaining(date)
        return (
          <div key={date} className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <div className="text-warning">{date === "تاریخ نامشخص" ? <span>تاریخ نامشخص</span> : <><span className="text-xs text-muted-foreground">{date}</span><span>{formatPersianDateLong(date) ?? date}</span></>}</div>
              {remaining !== null && date !== "تاریخ نامشخص" && <div className="text-xs">{remaining > 0 ? <>{formatDaysRemainInPersian(remaining)} {persianWeekDayFromDays(remaining)} <span className="text-muted-foreground">({remaining} روز)</span></> : <span className="text-muted-foreground">گذشته</span>}</div>}
            </div>
            <div className="space-y-2.5">
              {items.map((o) => {
                const times = extractTimes(o.examSchedule)
                return (
                  <button type="button" key={o.index} className="relative flex w-full cursor-pointer flex-col gap-2 rounded-lg border bg-card px-4 pt-6 pb-4 text-start text-sm" onClick={() => onSelect(o)}>
                    <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1"><p className="line-clamp-1 text-sm">{o.courseName}</p></div><ChevronLeft className="size-4 min-w-fit text-muted-foreground" /></div>
                    <div className="flex items-center justify-between text-xs"><p className="text-muted-foreground">{professorName(o) ?? "استادی ثبت نشده"}</p>{times.length > 0 && <div className="text-sm font-medium text-warning">{times[0]}{times[1] ? ` تا ${times[1]}` : ""}</div>}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
