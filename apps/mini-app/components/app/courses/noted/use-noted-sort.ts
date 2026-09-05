"use client"

import type { Offering } from "@/lib/api"
import {
  classSessions,
  joinSchedules,
} from "@/components/app/profile/schedule-util"

/** Fixed Persian weekday order (spaced canonical form, matches extractWeekday). */
const ORDER = ["شنبه", "یکشنبه", "دوشنبه", "سه شنبه", "چهارشنبه", "پنج شنبه", "جمعه"]

function toMinutes(t: string | null): number | null {
  if (!t) return null
  const [hStr, mStr] = t.split(":")
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

/** Earliest session defines the offering's sort position. */
function sortKey(o: Offering): { day: number; start: number } {
  const sessions = classSessions(o)
    .filter((s) => s.day != null)
    .sort((a, b) => (toMinutes(a.start) ?? 0) - (toMinutes(b.start) ?? 0))
  const first = sessions[0]
  const day = first?.day ? ORDER.indexOf(first.day) : -1
  return { day: day < 0 ? 99 : day, start: toMinutes(first?.start ?? null) ?? 24 * 60 + 1 }
}

export function useNotedSort(notedOfferings: Offering[]) {
  return notedOfferings.toSorted((a, b) => {
    const ka = sortKey(a)
    const kb = sortKey(b)
    return (
      ka.day - kb.day ||
      ka.start - kb.start ||
      (joinSchedules(a.classSchedule) ?? "").localeCompare(
        joinSchedules(b.classSchedule) ?? ""
      )
    )
  })
}
