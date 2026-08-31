import { ChevronLeft } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Settings list row used as a drawer trigger - icon tile, bold title and a
 * muted description line (old SettingsCard look).
 *
 * Renders a REAL <button> (Base UI triggers need native button semantics)
 * and spreads ALL received props onto it - that spread is how the
 * DrawerTrigger's click/dismiss handlers reach this component.
 */
export function SettingsRow({
  icon,
  title,
  description,
  className,
  ...props
}: {
  icon: React.ReactNode
  title: string
  description: string
  className?: string
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 px-4 py-5 text-start",
        className
      )}
      {...props}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronLeft className="size-5 shrink-0 text-muted-foreground" />
    </button>
  )
}
