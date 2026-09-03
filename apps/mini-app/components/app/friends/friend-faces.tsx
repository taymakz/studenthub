"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"

import type { FriendCard } from "@/lib/api"

/**
 * Instagram-style stacked faces ("liked by…") for a course card. Rendered
 * only when at least one friend noted the course; the React Compiler
 * memoizes it automatically (no manual memo).
 */
export function FriendFaces({
  sample,
  count,
  onClick,
}: {
  sample: FriendCard[]
  count: number
  onClick: () => void
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
      className="absolute top-2 right-2 z-10 flex cursor-pointer items-center transition-transform active:scale-95"
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
            className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-card"
          >
            +{extra}
          </span>
        )}
      </span>
    </button>
  )
}
