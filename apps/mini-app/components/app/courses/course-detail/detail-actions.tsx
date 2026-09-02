"use client"

import { BookmarkAdd, BookmarkMinus, SquareForward } from "reicon-react"
import { Users } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toastManager } from "@workspace/ui/components/toast"

import type { Offering } from "@/lib/api"
import { courseLine } from "./../sections"

export function DetailActions({
  offering,
  isNoted,
  canEditNoted,
  onToggleNote,
  onStudents,
}: {
  offering: Offering | null
  isNoted: boolean
  canEditNoted: boolean
  onToggleNote: (idx: string) => void
  onStudents: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {!isNoted ? (
          <Button
            className="flex-1 gap-1.5 text-sm"
            disabled={!canEditNoted}
            onClick={() => {
              if (offering) {
                onToggleNote(offering.index)
                toastManager.add({ type: "success", title: "اضافه شد.", data: { variant: "x" } })
              }
            }}
          >
            <BookmarkAdd size={24} />
            {canEditNoted ? "اضافه کردن به یادداشت‌ها" : "نیم سال انتخابی قدیمی است"}
          </Button>
        ) : (
          <Button
            variant="destructive"
            className="flex-1 gap-1.5 text-sm"
            disabled={!canEditNoted}
            onClick={() => {
              if (offering) {
                onToggleNote(offering.index)
                toastManager.add({ type: "success", title: "حذف شد.", data: { variant: "x" } })
              }
            }}
          >
            <BookmarkMinus size={24} />
            {canEditNoted ? "حذف از یادداشت‌ها" : "نیم سال انتخابی قدیمی است"}
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="اشتراک گذاری"
          onClick={() => {
            if (!offering) return
            const text = courseLine(offering, "full")
            const miniAppUrl = typeof window !== "undefined" ? window.location.origin : ""
            const url = encodeURIComponent(`${miniAppUrl}/?startapp=cd${offering.courseCode}&mode=fullscreen`)
            const shareLink = `https://t.me/share/url?url=${url}&text=${encodeURIComponent(text)}`
            window.open(shareLink, "_blank")
          }}
        >
          <SquareForward size={24} />
        </Button>
      </div>
      <Button variant="outline" className="w-full gap-2 text-sm" onClick={onStudents}>
        <Users className="size-4" />
        مشاهده دانشجویان این درس
      </Button>
    </div>
  )
}
