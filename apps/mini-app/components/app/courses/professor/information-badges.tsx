"use client"

import { Check, X } from "lucide-react"

export function BooleanBadges({
  providesSampleQuestions,
  providesNotes,
  mandatoryAttendance,
}: {
  providesSampleQuestions?: number | null
  providesNotes?: number | null
  mandatoryAttendance?: number | null
}) {
  const showSample = (providesSampleQuestions ?? 0) > 0.5
  const showNotes = (providesNotes ?? 0) > 0.5
  const showAttendance = (mandatoryAttendance ?? 0) > 0.5
  if (!showSample && !showNotes && !showAttendance) return null

  return (
    <div className="flex min-h-6 flex-wrap gap-2 text-sm">
      {showSample && (
        <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-success">
          <Check className="size-3" />
          نمونه سوال
        </span>
      )}
      {showNotes && (
        <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-success">
          <Check className="size-3" />
          جزوه
        </span>
      )}
      {showAttendance && (
        <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-destructive">
          <X className="size-3" />
          حضور اجباری
        </span>
      )}
    </div>
  )
}
