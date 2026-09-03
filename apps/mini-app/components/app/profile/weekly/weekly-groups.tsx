"use client"

import { ChevronLeft } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { professorName, type FriendCard } from "@/lib/api"
import { extractTimes } from "./../schedule-util"
import type { Offering } from "@/lib/api"
import { FriendFaces } from "@/components/app/friends/friend-faces"

const DAY_ORDER = ["شنبه","یکشنبه","دوشنبه","سه شنبه","چهارشنبه","پنج شنبه","جمعه"]

export function WeeklyGroups({
  groups,
  onSelect,
  readOnly = false,
  matesByIndex,
  onMatesClick,
}: {
  groups: { day: string; items: Offering[] }[]
  onSelect?: (o: Offering) => void
  /** Friend view: same UI without chevron or tap handling. */
  readOnly?: boolean
  matesByIndex?: Map<string, { count: number; sample: FriendCard[] }>
  onMatesClick?: (o: Offering) => void
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
                const mates = matesByIndex?.get(o.index)
                const body = (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1"><p className="line-clamp-1">{o.courseName}</p></div>{!readOnly && <ChevronLeft className="size-4 min-w-fit text-muted-foreground" />}</div>
                    <div className="flex items-center justify-between text-xs"><p className="text-muted-foreground">{professorName(o) ?? "استادی ثبت نشده"}</p>{times.length > 0 && <div className="font-medium text-info">از {times[0]} تا {times[1]}</div>}</div>
                    {o.location && <p className="text-xs text-muted-foreground">{o.location}</p>}
                  </>
                )
                const row = readOnly ? (
                  <div className="relative w-full space-y-2 rounded-lg border bg-card px-4 pt-6 pb-4 text-sm">{body}</div>
                ) : (
                  <button type="button" className={cn("relative w-full cursor-pointer space-y-2 rounded-lg border bg-card px-4 pt-6 pb-4 text-start text-sm")} onClick={() => onSelect?.(o)}>{body}</button>
                )
                return (
                  <div key={o.index}>
                    {mates && mates.count > 0 && (
                      <div className="mb-1 flex justify-start">
                        <FriendFaces
                          sample={mates.sample}
                          count={mates.count}
                          onClick={() => onMatesClick?.(o)}
                          className="static"
                        />
                      </div>
                    )}
                    {row}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
