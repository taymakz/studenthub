"use client"

import { toastManager } from "@workspace/ui/components/toast"
import { drawExportHeader, drawExportRow, exportPalette } from "./../export-canvas"
import { exportImage, ExportUploadCanceled } from "@/lib/export-image"
import { extractTimes } from "./../schedule-util"
import { professorName } from "@/lib/api"
import type { Offering } from "@/lib/api"

export async function captureWeeklyScreenshot(groups: { day: string; items: Offering[] }[], isDark: boolean, user: { photoUrl?: string | null; firstName?: string }, cancelRef: React.MutableRefObject<(() => void) | null>) {
  const palette = exportPalette(isDark, "green")
  const canvasWidth = 800
  const estimatedHeight = 50 + 200 + 20 + 40 + 60 + groups.reduce((h, g) => h + 50 + g.items.length * 140 + 30, 0) + 50
  const canvasHeight = Math.max(600, estimatedHeight)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  canvas.width = canvasWidth; canvas.height = canvasHeight
  ctx.fillStyle = palette.bg; ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  ctx.direction = "rtl"; ctx.textAlign = "right"; ctx.textBaseline = "top"
  let y = 50
  y = await drawExportHeader(ctx, canvasWidth, y, isDark, palette, user.photoUrl, user.firstName || "دانشجو", "برنامه هفتگی")
  for (const group of groups) {
    if (group.items.length === 0) continue
    ctx.font = `28px Vazirmatn, sans-serif`; ctx.fillStyle = palette.accent; ctx.textAlign = "right"; ctx.fillText(group.day, canvasWidth - 70, y); y += 50
    for (const o of group.items) {
      const times = extractTimes(o.classSchedule)
      y = drawExportRow(ctx, canvasWidth, y, isDark, palette, { name: o.courseName, professor: professorName(o) ?? null, leftTop: times.length > 0 ? `${times[0]} تا ${times[1] ?? ""}`.trim() : undefined, leftBottom: o.location ?? undefined })
    }
    y += 30
  }
  const blob = await new Promise<Blob>((resolve, reject) => { canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("خطا در ساخت تصویر"))), "image/png", 1.0) })
  try {
    await exportImage(blob, "weekly", undefined, cancelRef)
    toastManager.add({ type: "success", title: "عکس با موفقیت ارسال شد", description: "در تلگرام برای شما ارسال شد", data: { variant: "x" } })
  } catch (uploadError) {
    if (uploadError instanceof ExportUploadCanceled) { toastManager.add({ type: "info", title: "بارگذاری فایل لغو شد", data: { variant: "x" } }); return }
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `weekly-schedule-${Date.now()}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url)
    toastManager.add({ type: "warning", title: "آپلود ناموفق، فایل به صورت محلی دانلود شد", data: { variant: "x" } })
    throw uploadError
  }
}
