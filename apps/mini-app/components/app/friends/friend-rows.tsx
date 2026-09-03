"use client"

import type * as React from "react"
import { Ban, Check, Undo2, UserMinus, X } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

import type { FriendCard } from "@/lib/api"

export function FriendAvatar({ user }: { user: FriendCard }) {
  const initials = (user.firstName?.[0] ?? "?") + (user.lastName?.[0] ?? "")
  return (
    <Avatar size="sm">
      {user.photoUrl ? (
        <AvatarImage src={user.photoUrl} alt={user.firstName} />
      ) : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}

/** Card row: avatar + name + optional subtitle + action buttons. */
export function PersonRow({
  user,
  subtitle,
  children,
}: {
  user: FriendCard
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <FriendAvatar user={user} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {user.firstName} {user.lastName ?? ""}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-1">{children}</div> : null}
    </div>
  )
}

function IconAction({
  label,
  title,
  onClick,
  danger,
  children,
}: {
  label: string
  title?: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      className={danger ? "text-destructive" : undefined}
    >
      {children}
    </Button>
  )
}

export function AcceptAction({ onClick }: { onClick: () => void }) {
  return (
    <IconAction label="پذیرش" onClick={onClick}>
      <Check className="size-4 text-success" />
    </IconAction>
  )
}

export function DeclineAction({ onClick }: { onClick: () => void }) {
  return (
    <IconAction label="رد" onClick={onClick} danger>
      <X className="size-4" />
    </IconAction>
  )
}

export function BlockAction({ onClick }: { onClick: () => void }) {
  return (
    <IconAction label="مسدود کردن" onClick={onClick} danger>
      <Ban className="size-4" />
    </IconAction>
  )
}

export function UnfriendAction({ onClick }: { onClick: () => void }) {
  return (
    <IconAction label="حذف از دوستان" onClick={onClick} danger>
      <UserMinus className="size-4" />
    </IconAction>
  )
}

export function UnblockAction({ onClick }: { onClick: () => void }) {
  return (
    <IconAction label="رفع مسدودیت" onClick={onClick}>
      <Undo2 className="size-4" />
    </IconAction>
  )
}

export function FriendsLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <Spinner />
      <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
    </div>
  )
}

export function FriendsError({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-destructive/10 p-4 text-center">
      <p className="text-sm text-destructive">{message}</p>
    </div>
  )
}

export function FriendsEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export function LoadMoreButton({
  isFetching,
  onLoadMore,
}: {
  isFetching: boolean
  onLoadMore: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-2 w-full"
      disabled={isFetching}
      onClick={onLoadMore}
    >
      {isFetching ? <Spinner /> : "نمایش بیشتر"}
    </Button>
  )
}
