"use client"

import type { Offering } from "@/lib/api"

/**
 * Shared canvas renderer pieces for the خروجی عکس feature
 * (برنامه هفتگی / برنامه امتحانی) — ported from the old project's
 * WeeklySchedule.vue / ExamSchedule.vue with the same dark/light palettes.
 */

export interface ExportPalette {
  bg: string
  card: string
  cardBorder: string
  text: string
  muted: string
  accent: string
}

export function exportPalette(
  isDark: boolean,
  accent: "green" | "red"
): ExportPalette {
  return {
    bg: isDark ? "#0a0a0a" : "#f5f5f5",
    card: isDark ? "#171717" : "#ffffff",
    cardBorder: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
    text: isDark ? "#fafafa" : "#0a0a0a",
    muted: isDark ? "#a3a3a3" : "#737373",
    accent:
      accent === "green"
        ? isDark
          ? "#10b981"
          : "#059669"
        : isDark
          ? "#ef4444"
          : "#dc2626",
  }
}

const FONT = "Vazirmatn, IRANYekan, sans-serif"

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r)
  } else {
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }
}

/** Loads the user's Telegram avatar through the mini-app proxy (CORS-safe). */
export function loadUserAvatar(
  photoUrl: string | null | undefined
): Promise<HTMLImageElement | null> {
  if (!photoUrl) return Promise.resolve(null)
  const src = `/api/proxy-image?url=${encodeURIComponent(photoUrl)}`
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Avatar circle + name + big accent title. Returns the Y after the header. */
export async function drawExportHeader(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  startY: number,
  isDark: boolean,
  palette: ExportPalette,
  photoUrl: string | null | undefined,
  firstName: string,
  title: string
): Promise<number> {
  let y = startY
  const imageSize = 200

  const img = await loadUserAvatar(photoUrl)
  if (img) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(canvasWidth / 2, y + imageSize / 2, imageSize / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, canvasWidth / 2 - imageSize / 2, y, imageSize, imageSize)
    ctx.restore()
  } else {
    // Fallback: circle with the user's initial
    ctx.fillStyle = isDark ? "#374151" : "#d1d5db"
    ctx.beginPath()
    ctx.arc(canvasWidth / 2, y + imageSize / 2, imageSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = `bold 40px ${FONT}`
    ctx.fillStyle = isDark ? "#fafafa" : "#0a0a0a"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(firstName.charAt(0), canvasWidth / 2, y + imageSize / 2)
    ctx.textBaseline = "top"
  }

  y += imageSize + 20

  ctx.font = `28px ${FONT}`
  ctx.fillStyle = palette.text
  ctx.textAlign = "center"
  ctx.fillText(firstName, canvasWidth / 2, y)
  y += 60

  ctx.font = `40px ${FONT}`
  ctx.fillStyle = palette.accent
  ctx.fillText(title, canvasWidth / 2, y)
  ctx.textAlign = "right"
  y += 100
  return y
}

export interface ExportRow {
  name: string
  professor: string | null
  leftTop?: string
  leftBottom?: string
}

/** One course card row (name/professor right, optional meta left). */
export function drawExportRow(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  y: number,
  isDark: boolean,
  palette: ExportPalette,
  row: ExportRow
): number {
  ctx.fillStyle = palette.card
  const rectX = 50
  const rectY = y + 5
  const rectWidth = canvasWidth - 100
  const rectHeight = 110
  roundRect(ctx, rectX, rectY, rectWidth, rectHeight, 12)
  ctx.fill()
  ctx.strokeStyle = palette.cardBorder
  ctx.lineWidth = 1
  ctx.stroke()

  const rightMargin = canvasWidth - 50

  ctx.font = `24px ${FONT}`
  ctx.fillStyle = palette.text
  ctx.textAlign = "right"
  ctx.fillText(row.name, rightMargin - 20, y + 25)

  ctx.font = `20px ${FONT}`
  ctx.fillStyle = palette.muted
  ctx.fillText(row.professor || "استادی ثبت نشده", rightMargin - 20, y + 78)

  if (row.leftTop) {
    ctx.font = `20px ${FONT}`
    ctx.fillStyle = palette.accent
    ctx.textAlign = "left"
    ctx.fillText(row.leftTop, 70, y + 78)
    if (row.leftBottom) {
      ctx.font = `18px ${FONT}`
      ctx.fillStyle = isDark ? "#9ca3af" : "#6b7280"
      // Clear gap between the date and the time instead of tight space-joining
      const dateWidth = ctx.measureText(row.leftTop).width
      ctx.fillText(row.leftBottom, 70 + dateWidth + 28, y + 78)
    }
    ctx.textAlign = "right"
  } else if (row.leftBottom) {
    ctx.font = `18px ${FONT}`
    ctx.fillStyle = isDark ? "#9ca3af" : "#6b7280"
    ctx.textAlign = "left"
    ctx.fillText(row.leftBottom, 70, y + 78)
    ctx.textAlign = "right"
  }

  return y + 140
}

/** Fixed Persian weekday order (شنبه → جمعه) used by both tools - synced with extension/packages/ui canonical (سه شنبه/پنج شنبه with space). */
export const PERSIAN_WEEKDAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه شنبه",
  "چهارشنبه",
  "پنج شنبه",
  "جمعه",
] as const

/** Current Persian weekday, normalized against PERSIAN_WEEKDAYS (null = unknown). */
export function currentPersianWeekday(): string | null {
  try {
    const name = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      weekday: "long",
    }).format(new Date())
    const norm = name.replace(/[\s\u200c]/g, "")
    const found = PERSIAN_WEEKDAYS.find(
      (d) => d.replace(/[\s\u200c]/g, "") === norm
    )
    return found ?? null
  } catch {
    return null
  }
}

/** Current time as HH:MM (24h). */
export function currentTimeHHMM(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}

function toMinutes(time: string): number | null {
  const [hStr, mStr] = time.split(":")
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

/** Groups noted offerings by weekday (fixed order, sorted by start time). */
export function groupByWeekday(
  offerings: Offering[],
  weekdayOf: (o: Offering) => string | null
): Array<{ day: string; items: Offering[] }> {
  const map = new Map<string, Offering[]>()
  for (const o of offerings) {
    const day = weekdayOf(o)
    if (!day) continue
    map.set(day, [...(map.get(day) ?? []), o])
  }
  const startTime = (o: Offering): number => {
    const times = [
      ...(o.classSchedule?.matchAll(/\b(\d{1,2}:\d{2})\b/g) ?? []),
    ].map((m) => m[1]!)
    const s = times[0]
    if (!s) return 0
    const [hStr, mStr] = s.split(":")
    const h = Number(hStr)
    const m = Number(mStr)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
    return h * 60 + m
  }
  return PERSIAN_WEEKDAYS.filter((d) => map.has(d)).map((day) => ({
    day,
    items: (map.get(day) ?? []).sort((a, b) => startTime(a) - startTime(b)),
  }))
}

/**
 * «کلاس بعدی …» — same output shapes as the old project's
 * getSoonestCourseClassSchedule (الان / X دقیقه دیگه / فردا HH:MM / …).
 */
export function soonestClassMessage(
  groups: Array<{ day: string; items: Offering[] }>,
  startMinutesOf: (o: Offering) => number | null,
  endMinutesOf: (o: Offering) => number | null,
  startTimeOf: (o: Offering) => string | null
): string {
  const today = currentPersianWeekday()
  const now = toMinutes(currentTimeHHMM()) ?? 0
  const todayIndex = today ? PERSIAN_WEEKDAYS.findIndex((d) => d === today) : -1

  for (let i = 0; i < 7; i++) {
    const idx = todayIndex < 0 ? i : (todayIndex + i) % 7
    const day = PERSIAN_WEEKDAYS[idx]
    const group = groups.find((g) => g.day === day)
    if (!group || group.items.length === 0) continue

    if (i === 0) {
      let soonest: { m: number; str: string } | null = null
      for (const o of group.items) {
        const s = startMinutesOf(o)
        const e = endMinutesOf(o)
        if (s == null || e == null) continue
        if (now >= s && now <= e) return "الان"
        if (now < s && (soonest == null || s < soonest.m)) {
          soonest = { m: s, str: startTimeOf(o) ?? "" }
        }
      }
      if (soonest) {
        const remaining = soonest.m - now
        if (remaining <= 1)
          return `کلاس بعدی ${Math.ceil(remaining * 60)} ثانیه دیگه`
        if (remaining < 60)
          return `کلاس بعدی ${Math.floor(remaining)} دقیقه دیگه`
        if (remaining < 240) {
          const h = Math.floor(remaining / 60)
          const m = remaining % 60
          return `کلاس بعدی ${h} ساعت و ${m} دقیقه دیگر`
        }
        return `کلاس بعدی ${Math.floor(remaining / 60)} ساعت دیگه`
      }
    } else {
      const first = group.items[0]
      const str = first ? startTimeOf(first) : null
      if (str) {
        if (i === 1) return `کلاس بعدی فردا ${str}`
        if (i === 2) return `کلاس بعدی پس فردا ${str}`
        return `کلاس بعدی ${i} روز دیگه ${str}`
      }
    }
  }
  return "برنامه خالی میباشد"
}
