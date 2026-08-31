import * as React from "react"

import { SidebarToggle } from "@/components/sidebar-toggle"
import { TodayDate } from "@/components/today-date"
import { cn } from "@workspace/ui/lib/utils"

const actionButton =
  "inline-flex size-7 shrink-0  items-center justify-center rounded-full px-0.5 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground [&_svg]:size-4"

function HeaderIcon({ svg }: { svg: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/** Ghost icon button used in the page header (28px, fully round on hover). */
export function HeaderAction({
  label,
  onClick,
  svg,
}: {
  label: string
  onClick?: () => void
  svg: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={actionButton}
    >
      <HeaderIcon svg={svg} />
    </button>
  )
}

/** Sticky toolbar at the top of the page content: sidebar toggle, title,
    then optional page-specific actions passed as children on the end side. */
export function PageHeader({
  title,
  children,
  className,
}: {
  title: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-11 shrink-0 items-center border-b border-border/60 bg-secondary px-2",
        className
      )}
    >
      <div className="flex min-w-0 grow items-center">
        <SidebarToggle />
        <div className="flex min-w-0 items-center ps-2.5 pe-1">
          <h2 className="min-w-0 shrink truncate text-[0.8125rem] leading-normal font-medium">
            {title}
          </h2>
          <TodayDate className="ms-3 hidden shrink-0 text-xs text-muted-foreground md:inline" />
        </div>
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-1">{children}</div>
      )}
    </header>
  )
}
