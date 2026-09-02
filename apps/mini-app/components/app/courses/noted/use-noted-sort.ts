"use client"

import type { Offering } from "@/lib/api"
import { extractWeekday } from "@/components/app/profile/schedule-util"

export function useNotedSort(notedOfferings: Offering[]) {
  const order = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"]
  return notedOfferings.toSorted((a,b)=>{
    const da = order.indexOf(extractWeekday(a.classSchedule) ?? "")
    const db = order.indexOf(extractWeekday(b.classSchedule) ?? "")
    return (da<0?99:da)-(db<0?99:db) || (a.classSchedule??"").localeCompare(b.classSchedule??"")
  })
}
