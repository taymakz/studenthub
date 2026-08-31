"use client"

import { useEffect, useState } from "react"

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹"

function toFa(n: number): string {
  return String(n).replace(/\d/g, (c) => FA_DIGITS[Number(c)] ?? c)
}

function formatAgo(ms: number, now: number): string {
  const diff = Math.max(0, now - ms)
  const minutes = Math.floor(diff / 60_000)

  if (minutes < 1) return "چند لحظه پیش"
  if (minutes < 60) return `${toFa(minutes)} دقیقه پیش`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${toFa(hours)} ساعت پیش`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${toFa(days)} روز پیش`

  const months = Math.floor(days / 30)
  if (months < 12) return `${toFa(months)} ماه پیش`

  return `${toFa(Math.floor(months / 12))} سال پیش`
}

/** Persian relative time (e.g. «۲ ساعت پیش») that refreshes every 30s. */
export function useTimeAgo(time: number | null | undefined): string {
  // `Date.now()` is deferred into an effect so it isn't evaluated during the
  // prerender (Next blocks `Date.now()` in client components upfront).
  const [now, setNow] = useState(0)

  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const t = setInterval(update, 30_000)
    return () => clearInterval(t)
  }, [])

  if (!time || now === 0) return "نامشخص"
  return formatAgo(time, now)
}
