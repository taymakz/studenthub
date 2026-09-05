"use client"

import { ChevronLeft } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { professorName, type FriendCard } from "@/lib/api"
import type { WeeklyEntry } from "./../export-canvas"
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
  groups: { day: string; items: WeeklyEntry[] }[]
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
              {items.map((entry) => {
                const o = entry.offering
                const entryKey = `${o.index}-${entry.sessionIndex}`
                const mates = matesByIndex?.get(o.index)
                const hasMates = !!mates && mates.count > 0 && !!onMatesClick
                const body = (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1"><p className="line-clamp-1">{o.courseName}</p></div>{!readOnly && <ChevronLeft className="size-4 min-w-fit text-muted-foreground" />}</div>
                    <div className="flex items-center justify-between text-xs"><p className="text-muted-foreground">{professorName(o) ?? "استادی ثبت نشده"}</p>{entry.start && entry.end && <div className="font-medium text-info">از {entry.start} تا {entry.end}</div>}</div>
                    {entry.location && <p className="text-xs text-muted-foreground">{entry.location}</p>}
                  </>
                )
                // With mates the card becomes the bordered container: a faces
                // button (mates list) plus an empty-area button (same card
                // action) as valid siblings — no nested buttons, all native.
                if (hasMates) {
                  return (
                    <div key={entryKey} className="rounded-lg border bg-card px-4 pt-3 pb-4 text-sm">
                      <div className="mb-2 flex items-center gap-2">
                        <FriendFaces
                          sample={mates.sample}
                          count={mates.count}
                          onClick={() => onMatesClick?.(o)}
                          className="static"
                        />
                        <button
                          type="button"
                          aria-label="مشاهده جزئیات درس"
                          onClick={() => onSelect?.(o)}
                          className="flex h-6 flex-1 cursor-pointer items-center"
                        />
                      </div>
                      {readOnly ? (
                        <div className="space-y-2">{body}</div>
                      ) : (
                        <button type="button" className={cn("w-full cursor-pointer space-y-2 text-start")} onClick={() => onSelect?.(o)}>{body}</button>
                      )}
                    </div>
                  )
                }
                return readOnly ? (
                  <div key={entryKey} className="relative w-full space-y-2 rounded-lg border bg-card px-4 pt-6 pb-4 text-sm">{body}</div>
                ) : (
                  <button type="button" key={entryKey} className={cn("relative w-full cursor-pointer space-y-2 rounded-lg border bg-card px-4 py-4 text-start text-sm")} onClick={() => onSelect?.(o)}>{body}</button>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
