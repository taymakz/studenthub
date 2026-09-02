"use client"

import { Check } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

export function OptionRow({
  title,
  subtitle,
  leading,
  selected,
  onClick,
  onDoubleClick,
}: {
  title: string
  subtitle?: string
  leading?: React.ReactNode
  selected: boolean
  onClick: () => void
  onDoubleClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-start transition-colors",
        selected ? "border-primary" : "hover:border-border/80"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        {leading && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted p-1.5 text-foreground">
            {leading}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{title}</span>
          {subtitle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>}
        </span>
      </span>
      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", selected && "border-primary bg-primary text-primary-foreground")}>
        {selected && <Check className="size-3" />}
      </span>
    </button>
  )
}
