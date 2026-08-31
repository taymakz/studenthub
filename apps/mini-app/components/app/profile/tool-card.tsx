import type { ComponentType } from "react"
import type * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

interface ToolButtonProps {
  title: string
  icon: ComponentType<{ className?: string }>
  className?: string
}

/**
 * Circular tool button used inside the profile header tools. Renders a REAL
 * <button> (Base UI triggers need native button semantics) and spreads ALL
 * received props onto it — that spread is how DrawerTrigger's click/dismiss
 * handlers reach this component (same pattern as SettingsRow).
 */
export function ToolButton({
  title,
  icon: Icon,
  className,
  ...props
}: ToolButtonProps & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full flex-col items-center gap-2.5 transition-transform active:scale-95",
        className
      )}
      {...props}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-neutral-200 dark:bg-secondary/80">
        <Icon className="size-8" />
      </div>
      <p className="text-sm opacity-80">{title}</p>
    </button>
  )
}
