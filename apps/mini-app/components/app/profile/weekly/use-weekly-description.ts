"use client"

import { useEffect, useState } from "react"
import { extractTimes } from "./../schedule-util"
import { groupByWeekday, soonestClassMessage } from "./../export-canvas"
import type { Offering } from "@/lib/api"

export function useWeeklyDescription(groups: { day: string; items: Offering[] }[]) {
  const [description, setDescription] = useState("برنامه خالی میباشد")
  useEffect(() => {
    const startOf = (o: Offering) => {
      const t = extractTimes(o.classSchedule)[0]
      if (!t) return null
      const [hStr, mStr] = t.split(":")
      const h = Number(hStr); const m = Number(mStr)
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null
      return h * 60 + m
    }
    const endOf = (o: Offering) => {
      const t = extractTimes(o.classSchedule)[1]
      if (!t) return null
      const [hStr, mStr] = t.split(":")
      const h = Number(hStr); const m = Number(mStr)
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null
      return h * 60 + m
    }
    const strOf = (o: Offering) => extractTimes(o.classSchedule)[0] ?? null
    const update = () => setDescription(soonestClassMessage(groups, startOf, endOf, strOf))
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [groups])
  return description
}
