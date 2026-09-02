"use client"

import { useRef, useState } from "react"
import { toastManager } from "@workspace/ui/components/toast"
import { exportImage, ExportUploadCanceled } from "@/lib/export-image"

export function useScheduleExport(notedCount: number) {
  const cancelRef = useRef<(() => void) | null>(null)
  const [themeOpen, setThemeOpen] = useState(false)

  const runExport = async (isDark: boolean, capture: (isDark: boolean) => Promise<void>) => {
    if (notedCount > 30) {
      toastManager.add({ type: "error", title: "خروجی عکس ممکن نیست", description: "حداکثر ۳۰ درس برای خروجی عکس مجاز است", data: { variant: "x" } })
      throw new Error("export-limit")
    }
    await capture(isDark)
    setThemeOpen(false)
  }

  return { cancelRef, themeOpen, setThemeOpen, runExport }
}
