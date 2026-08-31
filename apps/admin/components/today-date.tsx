"use client"

import { useDate } from "@/hooks/use-date"
import {
  JALALI_MONTHS,
  PERSIAN_WEEKDAYS,
  toPersianDigits,
} from "@/lib/persian-date"

/** Today's Shamsi date, e.g. «۱۴۰۵ شهریور ۳, سه‌شنبه». */
export function TodayDate({ className }: { className?: string }) {
  const today = useDate({ interval: 0 })
  if (!today) return null

  return (
    <span className={className}>
      {toPersianDigits(String(today.year))} {JALALI_MONTHS[today.month - 1]}{" "}
      {toPersianDigits(String(today.day))}, {PERSIAN_WEEKDAYS[today.weekday]}
    </span>
  )
}
