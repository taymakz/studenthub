"use client"

import { toastManager } from "@workspace/ui/components/toast"
import { drawExportHeader, drawExportRow, exportPalette } from "./../export-canvas"
import { exportImage, ExportUploadCanceled } from "@/lib/export-image"
import { extractTimes, formatPersianDateLong } from "./../schedule-util"
import { professorName } from "@/lib/api"
import type { Offering } from "@/lib/api"

const EXAM_EXPORT_EXCLUDED = ["تربیت بدنی", "ورزش 1"]

export async function captureExamScreenshot(groups: { date: string; items: Offering[] }[], isDark: boolean, paletteUser: { photoUrl?: string | null; firstName?: string }, cancelRef: React.MutableRefObject<(() => void) | null>) {
  const palette = exportPalette(isDark, "red")
  const canvasWidth = 800
  const estimatedHeight = 50 + 200 + 20 + 40 + 60 + groups.reduce((h, g) => { const c = g.items.filter((o) => !EXAM_EXPORT_EXCLUDED.includes(o.courseName)).length; return h + 50 + c * 140 }, 0) + groups.length * 30 + 50
  const canvasHeight = Math.max(600, estimatedHeight)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  ctx.direction = "rtl"
  ctx.textAlign = "right"
  ctx.textBaseline = "top"
  let y = 50
  y = await drawExportHeader(ctx, canvasWidth, y, isDark, palette, paletteUser.photoUrl, paletteUser.firstName || "دانشجو", "برنامه امتحانی")
  for (const group of groups) {
    const groupItems = group.items.filter((o) => !EXAM_EXPORT_EXCLUDED.includes(o.courseName))
    if (groupItems.length === 0) continue
    ctx.font = `28px Vazirmatn, sans-serif`
    ctx.fillStyle = palette.accent
    ctx.textAlign = "right"
    ctx.fillText(formatPersianDateLong(group.date) ?? group.date, canvasWidth - 70, y)
    if (group.date !== "تاریخ نامشخص") {
      ctx.font = `20px Vazirmatn, sans-serif`
      ctx.fillStyle = palette.muted
      ctx.textAlign = "left"
      ctx.fillText(group.date, 70, y + 5)
    }
    ctx.textAlign = "right"
    y += 50
    for (const o of groupItems) {
      const times = extractTimes(o.examSchedule)
      y = drawExportRow(ctx, canvasWidth, y, isDark, palette, { name: o.courseName, professor: professorName(o) ?? null, leftTop: undefined, leftBottom: times[0] ? (times[1] ? `${times[0]} تا ${times[1]}` : times[0]) : undefined })
    }
    y += 30
  }
  const blob = await new Promise<Blob>((resolve, reject) => { canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("خطا در ساخت تصویر"))), "image/png", 1.0) })
  try {
    await exportImage(blob, "exam", undefined, cancelRef)
    toastManager.add({ type: "success", title: "عکس با موفقیت ارسال شد", description: "در تلگرام برای شما ارسال شد", data: { variant: "x" } })
  } catch (uploadError) {
    if (uploadError instanceof ExportUploadCanceled) { toastManager.add({ type: "info", title: "بارگذاری فایل لغو شد", data: { variant: "x" } }); return }
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url; link.download = `exam-schedule-${Date.now()}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url)
    toastManager.add({ type: "warning", title: "آپلود ناموفق، فایل به صورت محلی دانلود شد", data: { variant: "x" } })
    throw uploadError
  }
}
