"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"

import type { FriendCard } from "@/lib/api"

/**
 * Instagram-style stacked faces ("liked by…") for a course card. Rendered as
 * a sibling overlay (NOT inside the card button — nested buttons break
 * hydration), positioned absolute top-right by the parent.
 */
export function FriendFaces({
  sample,
  count,
  onClick,
  className,
}: {
  sample: FriendCard[]
  count: number
  onClick: () => void
  /** Override positioning (default absolute top-right overlay). */
  className?: string
}) {
  const shown = sample.slice(0, 5)
  const extra = count - shown.length
  return (
    <button
      type="button"
      aria-label={`${count} دوست این درس را برداشته‌اند`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "absolute top-1 right-4 z-10 flex cursor-pointer items-center transition-transform active:scale-95 isolate",
        className
      )}
    >
      <span className="flex -space-x-2">
        {shown.map((u) => (
          <Avatar key={u.id} className="size-6 ring-2 ring-card">
            {u.photoUrl ? (
              <AvatarImage src={u.photoUrl} alt={u.firstName} />
            ) : null}
            <AvatarFallback>
              {(u.firstName?.[0] ?? "?") + (u.lastName?.[0] ?? "")}
            </AvatarFallback>
          </Avatar>
        ))}
        {extra > 0 && (
          <span
            dir="ltr"
            className="relative z-10 flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-card"
          >
            +{extra}
          </span>
        )}
      </span>
    </button>
  )
}
