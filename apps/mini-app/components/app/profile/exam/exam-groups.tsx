"use client"

import { ChevronLeft } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type { Offering } from "@/lib/api"
import { professorName, type FriendCard } from "@/lib/api"
import { FriendFaces } from "@/components/app/friends/friend-faces"
import { extractTimes, formatDaysRemainInPersian, formatPersianDateLong, getCurrentDatePersian, persianDateDiff, persianWeekDayFromDays } from "./../schedule-util"

function daysRemaining(date: string): number | null {
  if (date === "تاریخ نامشخص") return null
  try { return persianDateDiff(getCurrentDatePersian(), date) } catch { return null }
}

export function ExamGroups({
  groups,
  onSelect,
  readOnly = false,
  matesByIndex,
  onMatesClick,
}: {
  groups: { date: string; items: Offering[] }[]
  onSelect?: (o: Offering) => void
  /** Friend view: same UI without chevron or tap handling. */
  readOnly?: boolean
  matesByIndex?: Map<string, { count: number; sample: FriendCard[] }>
  onMatesClick?: (o: Offering) => void
}) {
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
                const mates = matesByIndex?.get(o.index)
                const hasMates = !!mates && mates.count > 0 && !!onMatesClick
                const body = (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1"><p className="line-clamp-1 text-sm">{o.courseName}</p></div>{!readOnly && <ChevronLeft className="size-4 min-w-fit text-muted-foreground" />}</div>
                    <div className="flex items-center justify-between text-xs"><p className="text-muted-foreground">{professorName(o) ?? "استادی ثبت نشده"}</p>{times.length > 0 && <div className="text-sm font-medium text-warning">{times[0]}{times[1] ? ` تا ${times[1]}` : ""}</div>}</div>
                  </>
                )
                // With mates the card becomes the bordered container: faces
                // strip on top (real button, valid sibling), content below.
                if (hasMates) {
                  return (
                    <div key={o.index} className="rounded-lg border bg-card px-4 pt-3 pb-4 text-sm">
                      <div className="mb-2 flex justify-start">
                        <FriendFaces
                          sample={mates.sample}
                          count={mates.count}
                          onClick={() => onMatesClick?.(o)}
                          className="static"
                        />
                      </div>
                      {readOnly ? (
                        <div className="flex flex-col gap-2">{body}</div>
                      ) : (
                        <button type="button" className={cn("flex w-full cursor-pointer flex-col gap-2 text-start")} onClick={() => onSelect?.(o)}>{body}</button>
                      )}
                    </div>
                  )
                }
                return readOnly ? (
                  <div key={o.index} className="relative flex w-full flex-col gap-2 rounded-lg border bg-card px-4 pt-6 pb-4 text-sm">{body}</div>
                ) : (
                  <button type="button" key={o.index} className={cn("relative flex w-full cursor-pointer flex-col gap-2 rounded-lg border bg-card px-4 py-4 text-start text-sm")} onClick={() => onSelect?.(o)}>{body}</button>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
