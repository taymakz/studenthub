"use client"

import { Copy, Share2, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toastManager } from "@workspace/ui/components/toast"

import type { Offering } from "@/lib/api"
import { courseLine } from "./../course-format"
import { ExportDrawer } from "./export-drawer"
import { PreviewDrawer } from "./preview-drawer"

export function MainActions({
  offering,
  onDelete,
  onExport,
}: {
  offering: Offering
  onDelete: (idx: string) => void
  onExport: () => void
}) {
  return (
    <>
      <Button variant="outline" className="w-full" onClick={onExport}>
        <Copy className="size-4" />
        خروجی
      </Button>
      <div className="flex gap-2">
        <Button
          variant="blue"
          className="flex-1"
          onClick={() => {
            const text = courseLine(offering, "full")
            const miniAppUrl = typeof window !== "undefined" ? window.location.origin : ""
            const url = encodeURIComponent(`${miniAppUrl}/?startapp=cd${offering.courseCode}&mode=fullscreen`)
            const shareLink = `https://t.me/share/url?url=${url}&text=${encodeURIComponent(text)}`
            window.open(shareLink, "_blank")
          }}
        >
          <Share2 className="size-5" />
          اشتراک گذاری
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          onClick={() => {
            onDelete(offering.index)
            toastManager.add({ type: "success", title: "حذف شد از یادداشت‌ها", data: { variant: "x" } })
          }}
        >
          <Trash2 className="size-5" />
          حذف از یادداشت
        </Button>
      </div>
    </>
  )
}

export function ExportPanel({
  offering,
  open,
  onOpenChange,
  previewType,
  setPreviewType,
}: {
  offering: Offering | null
  open: boolean
  onOpenChange: (o: boolean) => void
  previewType: "full" | "nameUnit" | "code" | null
  setPreviewType: (v: "full" | "nameUnit" | "code" | null) => void
}) {
  return (
    <>
      <ExportDrawer
        offering={offering}
        open={open && !previewType}
        onOpenChange={onOpenChange}
        setPreviewType={setPreviewType}
      />
      <PreviewDrawer offering={offering} previewType={previewType} onClose={() => setPreviewType(null)} />
    </>
  )
}
