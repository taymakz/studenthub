"use client"

import { cn } from "@workspace/ui/lib/utils"

export function OptionGrid({
  options,
  value,
  onSelect,
  onCommit,
  onDoubleClick,
  columns = 2,
}: {
  options: Array<{ value: string; label: string }>
  value?: string
  onSelect: (v: string) => void
  onCommit?: (v: string) => void
  onDoubleClick?: (v: string) => void
  columns?: number
}) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => {
            onSelect(opt.value)
            onCommit?.(opt.value)
          }}
          onDoubleClick={() => onDoubleClick?.(opt.value)}
          className={cn(
            "rounded-full border bg-card px-4 py-2.5 text-center text-sm tabular-nums transition-colors",
            value === opt.value ? "border-primary" : "hover:border-border/80"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
