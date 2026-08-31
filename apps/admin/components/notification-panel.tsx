"use client"

import { X } from "lucide-react"
import { CheckRead } from "reicon/icons/CheckRead"

import { Badge } from "@workspace/ui/components/badge"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useNotifications } from "@/components/notification-store"
import type { NotificationTone } from "@/lib/fake-data"
import { toFa } from "@/lib/format"
import { cn } from "@workspace/ui/lib/utils"

/** Category chip colors: 600/15 in light mode, 400/15 in dark mode. */
const toneClasses: Record<NotificationTone, string> = {
  emerald:
    "bg-emerald-600/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400",
  sky: "bg-sky-600/15 text-sky-600 dark:bg-sky-400/15 dark:text-sky-400",
  violet:
    "bg-violet-600/15 text-violet-600 dark:bg-violet-400/15 dark:text-violet-400",
  amber:
    "bg-amber-600/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400",
  cyan: "bg-cyan-600/15 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-400",
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const items = useNotifications((s) => s.items)
  const markOneRead = useNotifications((s) => s.markOneRead)
  const markAllRead = useNotifications((s) => s.markAllRead)
  const unread = items.filter((item) => item.unread).length

  return (
    <div className="w-full">
      {/* Header: title/badge on the left, mark-all-read + close together on the right */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">اعلان‌ها</span>
          {unread > 0 && (
            <Badge className="border-transparent bg-rose-500/15 text-[10px] text-rose-500">
              {toFa(unread)} جدید
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Local provider: the panel renders in a popover portal, outside
              any ambient TooltipProvider. */}
          <TooltipProvider delay={300}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="خواندن همه"
                    onClick={markAllRead}
                    disabled={unread === 0}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4"
                    dangerouslySetInnerHTML={{
                      __html: CheckRead.toSvg({ size: 16 }),
                    }}
                  />
                }
              />
              <TooltipContent>خواندن همه</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            type="button"
            aria-label="بستن اعلان‌ها"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <Separator />

      {/* Scrollable list with top/bottom scroll fades */}
      <div className="relative">
        <ScrollArea className="max-h-72">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              همه را خوانده‌اید.
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => markOneRead(item.id)}
                className="flex w-full items-start gap-2.5 border-b border-border/50 px-3 py-2.5 text-start transition-colors last:border-b-0 hover:bg-accent/60"
              >
                {/* Category icon chip (reicon, tone-colored) */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-4",
                    toneClasses[item.tone]
                  )}
                  dangerouslySetInnerHTML={{
                    __html: item.icon.toSvg({ size: 16 }),
                  }}
                />

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        item.unread ? "font-medium" : "text-foreground/80"
                      )}
                    >
                      {item.title}
                    </span>
                    {item.unread && (
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full bg-rose-500"
                      />
                    )}
                    <span className="ms-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {item.time}
                    </span>
                  </span>
                  <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </span>
                </span>
              </button>
            ))
          )}
        </ScrollArea>
        {/* Scroll fades */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-linear-to-b from-popover to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-linear-to-t from-popover to-transparent"
        />
      </div>
    </div>
  )
}
