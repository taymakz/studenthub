import { ChevronLeft, CircleCheck } from "lucide-react"

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

/**
 * Picker row for settings drawers (theme, effects, …): icon + label on the
 * right, a check mark for the selected value or a muted «انتخاب» hint.
 */
export function SettingsOptionRow({
  icon: Icon,
  label,
  selected,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full cursor-pointer flex-row items-center px-4 py-5 text-start transition-colors hover:bg-muted/50 active:bg-muted"
    >
      <span className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2">
          <Icon className="size-5 opacity-80" />
          <p className="text-sm">{label}</p>
        </span>
        {selected ? (
          <CircleCheck className="size-5 text-success" />
        ) : (
          <span className="text-sm opacity-80">انتخاب</span>
        )}
      </span>
    </button>
  )
}
