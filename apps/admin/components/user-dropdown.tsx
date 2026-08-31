"use client"

import * as React from "react"

import { useTheme } from "next-themes"
import { ChevronDown, LogOut, Palette } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { THEME_OPTIONS as themeOptions } from "@/lib/theme-options"
import { cn } from "@workspace/ui/lib/utils"

import { useAuth } from "@/hooks/use-auth"
import type { AdminUser } from "@/services/auth.service"

function initials(user: AdminUser): string {
  const first = user.firstName?.trim()?.[0] ?? ""
  const last = user.lastName?.trim()?.[0] ?? ""
  return (first + last).toUpperCase() || "؟"
}

function UserAvatar({ user }: { user: AdminUser }) {
  return (
    <Avatar className="size-5 rounded-full">
      {user.photoUrl && (
        <AvatarImage src={user.photoUrl} alt={user.firstName} />
      )}
      <AvatarFallback className="rounded-full bg-foreground text-[8px] font-medium text-background">
        {initials(user)}
      </AvatarFallback>
    </Avatar>
  )
}

/** Sidebar dropdown: Telegram photo, name, @handle + theme + logout.
    Deliberately nothing else - the admin's profile lives in Telegram. */
function UserDropdown({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()

  if (!user) return null

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.telegramUsername ||
    "مدیر"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-start transition-colors outline-none hover:bg-sidebar-accent focus-visible:bg-sidebar-accent data-[popup-open]:bg-sidebar-accent"
          />
        }
      >
        {children}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-60"
      >
        {/* Identity header: photo / name / @handle */}
        <DropdownMenuGroup>
          <div className="flex w-full items-center gap-2 px-2 py-1.5">
            <UserAvatar user={user} />
            {/* text-start resolves against this RTL container; the child's
                dir="ltr" only controls digit order of the handle. */}
            <div className="grid min-w-0 flex-1 text-start leading-tight">
              <span className="truncate text-sm font-medium">
                {displayName}
              </span>
              <span
                dir="ltr"
                className="truncate text-right font-mono text-xs text-muted-foreground"
              >
                {user.telegramUsername ? `@${user.telegramUsername}` : user.id}
              </span>
            </div>
          </div>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Theme: icon + label + bordered system/dark/light group */}
        <div className="flex h-8 w-full items-center justify-between gap-2 px-2 text-sm">
          <span className="flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" />
            ظاهر
          </span>
          <div className="flex items-center rounded-md border border-border/60 p-0.5">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                title={option.label}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex size-6 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  theme === option.value && "bg-accent text-accent-foreground"
                )}
              >
                <option.icon className="size-3.5" />
              </button>
            ))}
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
            <LogOut className="size-4" />
            خروج از حساب
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** First sidebar item: identity dropdown only - notifications/search rows are
    gone per product decision (no fake notification data in v1). */
export function SidebarProfileHeader() {
  const { user } = useAuth()

  return (
    <div className="flex items-center px-4 pt-6 pb-2">
      {user && (
        <UserDropdown>
          <UserAvatar user={user} />
          <span className="min-w-0 truncate text-xs">
            {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.telegramUsername}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </UserDropdown>
      )}
    </div>
  )
}
