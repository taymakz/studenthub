"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Ban,
  Eye,
  Handshake,
  MoreHorizontal,
  Send,
  Shield,
  UserCog,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuSeparator,
  ResponsiveMenuTrigger,
} from "@workspace/ui/components/responsive-menu"
import { cn } from "@workspace/ui/lib/utils"

import type { AdminRole, PublicUser } from "@/services/users.service"
import { usersService } from "@/services/users.service"
import { SendMessageDialog } from "@/components/telegram/send-message-dialog"

const ROLE_CONFIG: Record<AdminRole, { label: string; className: string }> = {
  SUPERADMIN: {
    label: "سوپرادمین",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  ADMIN: {
    label: "ادمین",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  NOTIFICATIONER: {
    label: "اطلاع‌رسان",
    className:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  },
  USER: {
    label: "کاربر",
    className: "bg-muted text-muted-foreground border-border",
  },
}

function relativeTime(iso: string | null): string {
  if (!iso) return "هرگز"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "همین الان"
  if (mins < 60) return `${mins} دقیقه پیش`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ساعت پیش`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} روز پیش`
  const months = Math.floor(days / 30)
  return `${months} ماه پیش`
}

function initials(user: PublicUser): string {
  const f = user.firstName?.[0] ?? ""
  const l = user.lastName?.[0] ?? ""
  return f + l || "?"
}

function isOnline(lastOnlineAt: string | null): boolean {
  if (!lastOnlineAt) return false
  return Date.now() - new Date(lastOnlineAt).getTime() < 60_000
}

function semesterLabel(entrySemester: string | null): string | null {
  if (!entrySemester) return null
  const map: Record<string, string> = {
    MEHR: "مهر",
    BAHMAN: "بهمن",
    SUMMER: "تابستانه",
  }
  return map[entrySemester] ?? entrySemester
}

export const UserCard = React.memo(function UserCard({
  user,
  onRoleChanged,
}: {
  user: PublicUser
  onRoleChanged?: () => void
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [banDialogOpen, setBanDialogOpen] = React.useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = React.useState(false)
  const [sendOpen, setSendOpen] = React.useState(false)
  const [contributorDialogOpen, setContributorDialogOpen] =
    React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const role = ROLE_CONFIG[user.role]
  const router = useRouter()
  const proxied = usersService.avatarUrl(user.photoUrl)
  const online = isOnline(user.lastOnlineAt)
  const profile = user.profile

  const genderRing = React.useMemo(
    () =>
      profile?.gender === "FEMALE"
        ? "ring-1 ring-pink-400 ring-offset-1 ring-offset-card"
        : profile?.gender === "MALE"
          ? "ring-1 ring-sky-500 ring-offset-1 ring-offset-card"
          : "ring-1 ring-muted-foreground/20 ring-offset-1 ring-offset-card",
    [profile?.gender]
  )

  const statusDot = React.useMemo(
    () =>
      user.banned
        ? "bg-destructive"
        : online
          ? "bg-emerald-500"
          : "bg-muted-foreground/30",
    [user.banned, online]
  )

  const handleToggleContributor = React.useCallback(async () => {
    setBusy(true)
    try {
      await usersService.toggleContributor(user.id)
      setContributorDialogOpen(false)
      onRoleChanged?.()
    } catch {
      // toast
    } finally {
      setBusy(false)
    }
  }, [user.id, onRoleChanged])

  const handleBan = React.useCallback(async () => {
    setBusy(true)
    try {
      await usersService.ban(user.id)
      setBanDialogOpen(false)
      onRoleChanged?.()
    } catch {
      // toast
    } finally {
      setBusy(false)
    }
  }, [user.id, onRoleChanged])

  const handleUnban = React.useCallback(async () => {
    setBusy(true)
    try {
      await usersService.unban(user.id)
      setMenuOpen(false)
      onRoleChanged?.()
    } catch {
      // toast
    } finally {
      setBusy(false)
    }
  }, [user.id, onRoleChanged])

  const handleRole = React.useCallback(
    async (next: AdminRole) => {
      setBusy(true)
      try {
        await usersService.setRole(user.id, next)
        setRoleDialogOpen(false)
        onRoleChanged?.()
      } catch {
        // toast
      } finally {
        setBusy(false)
      }
    },
    [user.id, onRoleChanged]
  )

  return (
    <Card
      className={cn(
        "group relative flex h-[280px] w-full flex-col overflow-hidden rounded-none border-0 bg-card shadow-none ring-0",
        user.banned && "bg-destructive/[0.04]"
      )}
    >
      <CardContent className="flex h-full gap-4 p-4">
        {/* Avatar - keep big, gender ring + status dot */}
        <div className="relative shrink-0 self-start">
          <a
            href={proxied ?? undefined}
            target={proxied ? "_blank" : undefined}
            rel={proxied ? "noopener noreferrer" : undefined}
            className={cn(
              "block rounded-full",
              proxied && "cursor-pointer transition-opacity hover:opacity-90"
            )}
            onClick={(e) => {
              if (!proxied) e.preventDefault()
              e.stopPropagation()
            }}
          >
            <Avatar
              className={cn(
                "size-32 border border-card sm:size-40",
                genderRing
              )}
            >
              <AvatarImage
                src={proxied ?? user.photoUrl ?? undefined}
                alt={user.firstName}
                loading="lazy"
                decoding="async"
              />
              <AvatarFallback className="text-base font-semibold">
                {initials(user)}
              </AvatarFallback>
            </Avatar>
          </a>
          <span
            className={cn(
              "absolute end-0 bottom-0 size-3 rounded-full border-2 border-card",
              statusDot
            )}
          />
        </div>

        {/* Info - redesigned with sharp sections */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden py-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <h3 className="truncate text-[15px] leading-tight font-semibold">
                {user.firstName} {user.lastName ? ` ${user.lastName}` : ""}
              </h3>
              {/* ID + username always LTR left */}
              {user.telegramUsername && (
                <p
                  dir="ltr"
                  className="truncate text-left font-mono text-[12px] leading-none text-muted-foreground select-text"
                >
                  @{user.telegramUsername}
                </p>
              )}
              <p
                dir="ltr"
                className="mt-1 truncate text-left font-mono text-[11px] leading-none text-muted-foreground/60 select-text"
              >
                {String(user.id)}
              </p>
            </div>
            <ResponsiveMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <ResponsiveMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 opacity-100 transition-opacity data-[state=open]:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </ResponsiveMenuTrigger>
              <ResponsiveMenuContent>
                <ResponsiveMenuItem onClick={() => setSendOpen(true)}>
                  <Send className="size-4" />
                  ارسال پیام
                </ResponsiveMenuItem>
                <ResponsiveMenuItem
                  onClick={() => router.push(`/users/${user.id}`)}
                >
                  <Eye className="size-4" />
                  مشاهده جزئیات
                </ResponsiveMenuItem>
                <ResponsiveMenuItem onClick={() => setRoleDialogOpen(true)}>
                  <UserCog className="size-4" />
                  مدیریت دسترسی
                </ResponsiveMenuItem>
                <ResponsiveMenuItem
                  onClick={() => setContributorDialogOpen(true)}
                >
                  <Handshake className="size-4" />
                  {user.isContributor
                    ? "حذف مشارکت‌کننده"
                    : "مشارکت‌کننده کردن"}
                </ResponsiveMenuItem>
                <ResponsiveMenuSeparator />
                {user.banned ? (
                  <ResponsiveMenuItem
                    onClick={handleUnban}
                    disabled={busy}
                    variant="destructive"
                  >
                    <Shield className="size-4" />
                    رفع مسدودی
                  </ResponsiveMenuItem>
                ) : (
                  <ResponsiveMenuItem
                    onClick={() => setBanDialogOpen(true)}
                    disabled={busy}
                    variant="destructive"
                  >
                    <Ban className="size-4" />
                    مسدود کردن
                  </ResponsiveMenuItem>
                )}
              </ResponsiveMenuContent>
            </ResponsiveMenu>
          </div>

          {/* Badges absolute top-left (end in RTL) */}
          <div className="absolute end-2 top-2 flex gap-1.5">
            {user.role !== "USER" && (
              <Badge
                variant="outline"
                className={cn(
                  "rounded-none px-1.5 py-0 text-[11px] leading-4",
                  role.className
                )}
              >
                {role.label}
              </Badge>
            )}
            {user.isContributor && (
              <Badge
                variant="outline"
                className="rounded-none border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[11px] leading-4 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
              >
                مشارکت‌کننده
              </Badge>
            )}
          </div>

          {/* Academic block separated by sharp border */}
          <div className="mt-3 border-t border-border pt-2.5">
            {profile && (profile.universitySlug || profile.majorSlug) ? (
              <div className="space-y-1 text-[11px] leading-relaxed">
                <p className="truncate font-medium text-foreground">
                  {profile.universityName ?? profile.universitySlug ?? "—"}
                  {profile.majorName
                    ? ` • ${profile.majorName}`
                    : profile.majorSlug
                      ? ` • ${profile.majorSlug}`
                      : ""}
                </p>
                <p className="truncate text-muted-foreground">
                  {[
                    profile.degreeName ?? profile.degree,
                    profile.entryYearRange,
                    semesterLabel(profile.entrySemester),
                    profile.termNumber ? `ترم ${profile.termNumber}` : null,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground/50">
                بدون اطلاعات دانشگاهی
              </p>
            )}
          </div>

          <p className="mt-auto truncate pt-2 text-[11px] text-muted-foreground/60">
            آخرین فعالیت: {relativeTime(user.lastOnlineAt)}
          </p>
        </div>
      </CardContent>

      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>مسدود کردن {user.firstName}؟</AlertDialogTitle>
            <AlertDialogDescription>
              کاربر قادر به استفاده از سیستم نخواهد بود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBan}
              disabled={busy}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              {busy ? "در حال انجام..." : "مسدود کن"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>مدیریت دسترسی</AlertDialogTitle>
            <AlertDialogDescription>
              نقش فعلی: {role.label}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            {(["USER", "ADMIN", "SUPERADMIN", "NOTIFICATIONER"] as const).map(
              (r) => (
                <Button
                  key={r}
                  variant={r === user.role ? "default" : "outline"}
                  className="justify-start"
                  disabled={r === user.role || busy}
                  onClick={() => handleRole(r)}
                >
                  {ROLE_CONFIG[r].label}
                </Button>
              )
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>بستن</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={contributorDialogOpen}
        onOpenChange={setContributorDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {user.isContributor
                ? `حذف مشارکت‌کننده از ${user.firstName}؟`
                : `مشارکت‌کننده کردن ${user.firstName}؟`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {user.isContributor
                ? "کاربر دیگر مشارکت‌کننده نخواهد بود."
                : "کاربر مشارکت‌کننده خواهد شد و پیام تبریک دریافت می‌کند."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleContributor}
              disabled={busy}
            >
              {busy ? "در حال انجام..." : user.isContributor ? "حذف" : "تایید"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SendMessageDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        user={user}
      />
    </Card>
  )
})
