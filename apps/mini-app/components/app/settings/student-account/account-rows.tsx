"use client"

import { ChevronLeft } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export function EditRow({ icon, label, value, badge, multiline = false, onClick }: { icon: React.ReactNode; label: string; value: string; badge?: React.ReactNode; multiline?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/40">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className={cn("block text-xs text-muted-foreground", multiline ? "leading-5 break-words" : "truncate")}>{value}</span></span>
      {badge}
      <ChevronLeft className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
    </button>
  )
}
