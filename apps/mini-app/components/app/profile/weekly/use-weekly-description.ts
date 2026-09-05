"use client"

import { useEffect, useState } from "react"
import { soonestClassMessage } from "./../export-canvas"
import type { WeeklyEntry } from "./../export-canvas"

export function useWeeklyDescription(groups: { day: string; items: WeeklyEntry[] }[]) {
  const [description, setDescription] = useState("برنامه خالی میباشد")
  useEffect(() => {
    const update = () => setDescription(soonestClassMessage(groups))
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [groups])
  return description
}
