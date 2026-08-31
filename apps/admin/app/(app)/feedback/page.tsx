"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Eye,
  MoreHorizontal,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogPopup,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@workspace/ui/components/responsive-alert-dialog"
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuSeparator,
  ResponsiveMenuTrigger,
} from "@workspace/ui/components/responsive-menu"

import { PageHeader } from "@/components/page-header"
import { useAuth } from "@/hooks/use-auth"
import { useFeedback, useFeedbackMutations } from "@/hooks/use-feedback"
import type {
  Feedback,
  FeedbackKind,
  FeedbackStatus,
} from "@/services/feedback.service"
import { formatDate } from "@/lib/persian-date"
import { useTimeAgo } from "@/hooks/use-time-ago"
import { usersService } from "@/services/users.service"

const kindDot: Record<string, string> = {
  BUG: "bg-destructive",
  SUGGESTION: "bg-sky-500",
  THANKS: "bg-emerald-500",
  SOURCE: "bg-violet-500",
}

const kindLabel: Record<string, string> = {
  BUG: "گزارش اشکال",
  SUGGESTION: "پیشنهاد",
  THANKS: "تشکر",
  SOURCE: "معرفی منبع",
}

const statusDot: Record<string, string> = {
  OPEN: "bg-amber-500",
  RESOLVED: "bg-emerald-500",
}

const statusLabel: Record<string, string> = {
  OPEN: "باز",
  RESOLVED: "حل‌شده",
}

function useDebounced<T>(value: T, ms = 300): T {
  const [d, setD] = React.useState(value)
  React.useEffect(() => {
    const id = setTimeout(() => setD(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return d
}

function FeedbackTime({ date }: { date: string }) {
  const ago = useTimeAgo(date, { calendarType: "shamsi" })
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs">
        {formatDate(new Date(date), "yyyy/MM/dd", { calendarType: "shamsi" })}
      </span>
      <span className="text-[11px] text-muted-foreground">{ago ?? ""}</span>
    </div>
  )
}

function UserCell({
  user,
  userId,
}: {
  user: Feedback["user"]
  userId: number
}) {
  if (!user) {
    return (
      <span className="font-mono text-xs" dir="ltr">
        {String(userId)}
      </span>
    )
  }
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.firstName
  const initials = (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")
  const avatarUrl =
    usersService.avatarUrl(user.photoUrl) ?? user.photoUrl ?? undefined
  const genderRing =
    user.profile?.gender === "FEMALE"
      ? "ring-2 ring-pink-400 ring-offset-1 ring-offset-background"
      : user.profile?.gender === "MALE"
        ? "ring-2 ring-sky-500 ring-offset-1 ring-offset-background"
        : "ring-2 ring-muted-foreground/20 ring-offset-1 ring-offset-background"
  const avatarSrc = avatarUrl
  return (
    <div className="flex items-center gap-2">
      {avatarSrc ? (
        <a
          href={avatarSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar className={`size-10 shrink-0 ${genderRing}`}>
            <AvatarImage src={avatarSrc} alt={fullName} />
            <AvatarFallback className="text-[11px]">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
        </a>
      ) : (
        <Avatar className={`size-10 shrink-0 ${genderRing}`}>
          <AvatarImage src={undefined} alt={fullName} />
          <AvatarFallback className="text-[11px]">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="flex min-w-0 flex-col select-text">
        <span className="truncate text-xs font-medium select-text">
          {fullName}
        </span>
        <span
          className="truncate text-right text-[11px] text-muted-foreground select-text"
          dir="ltr"
        >
          {user.telegramUsername
            ? `@${user.telegramUsername}`
            : String(user.id)}
        </span>
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [q, setQ] = React.useState("")
  const debouncedQ = useDebounced(q, 350)
  const [kind, setKind] = React.useState<string>("all")
  const [status, setStatus] = React.useState<string>("all")
  const [sort, setSort] = React.useState<"newest" | "oldest">("newest")
  const [page, setPage] = React.useState(1)
  const limit = 10

  const [selected, setSelected] = React.useState<Feedback | null>(null)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const selectedAgo = useTimeAgo(selected?.createdAt ?? "", {
    calendarType: "shamsi",
  } as any)

  const params = React.useMemo(
    () => ({
      page,
      limit,
      ...(debouncedQ.trim() ? { q: debouncedQ.trim() } : {}),
      ...(kind !== "all" ? { kind: kind as FeedbackKind } : {}),
      ...(status !== "all" ? { status: status as FeedbackStatus } : {}),
      sort,
    }),
    [page, debouncedQ, kind, status, sort]
  )

  const { feedback, pagination, isLoading } = useFeedback(params)
  const { resolve, reopen, remove } = useFeedbackMutations()

  const totalPages = Math.max(1, Math.ceil(pagination.total / limit))

  if (
    !authLoading &&
    user &&
    user.role !== "ADMIN" &&
    user.role !== "SUPERADMIN"
  ) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="بازخوردها" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="text-sm font-medium">دسترسی غیرمجاز</p>
          <p className="text-xs text-muted-foreground">
            فقط ادمین و سوپرادمین به این بخش دسترسی دارند.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col overflow-x-hidden">
      <PageHeader title="بازخوردها">
        <span className="text-xs text-muted-foreground">
          {pagination.total.toLocaleString("fa-IR")} مورد
        </span>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        {/* Filters - default shows Persian selected value */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
            <Search className="absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="جستجو"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              className="h-8 pe-8 text-sm"
            />
          </div>

          <Select
            value={kind}
            onValueChange={(v) => {
              if (v !== null) {
                setKind(v)
                setPage(1)
              }
            }}
          >
            <SelectTrigger className="h-8 w-fit min-w-[120px] text-sm">
              <SelectValue placeholder="نوع">
                {kind === "all" ? "همه انواع" : (kindLabel[kind] ?? kind)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه انواع</SelectItem>
              <SelectItem value="BUG">گزارش اشکال</SelectItem>
              <SelectItem value="SUGGESTION">پیشنهاد</SelectItem>
              <SelectItem value="THANKS">تشکر</SelectItem>
              <SelectItem value="SOURCE">معرفی منبع</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(v) => {
              if (v !== null) {
                setStatus(v)
                setPage(1)
              }
            }}
          >
            <SelectTrigger className="h-8 w-fit min-w-[110px] text-sm">
              <SelectValue placeholder="وضعیت">
                {status === "all"
                  ? "همه وضعیت‌ها"
                  : (statusLabel[status] ?? status)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="OPEN">باز</SelectItem>
              <SelectItem value="RESOLVED">حل‌شده</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sort}
            onValueChange={(v) => v !== null && setSort(v as never)}
          >
            <SelectTrigger className="h-8 w-fit min-w-[110px] text-sm">
              <SelectValue placeholder="مرتب‌سازی">
                {sort === "newest"
                  ? "جدیدترین"
                  : sort === "oldest"
                    ? "قدیمی‌ترین"
                    : sort}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">جدیدترین</SelectItem>
              <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : feedback.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="mb-3 size-10 opacity-30" />
            <p className="text-sm">بازخوردی یافت نشد</p>
          </div>
        ) : (
          <Table variant="card" className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>کاربر</TableHead>
                <TableHead>پیام</TableHead>
                <TableHead>نوع</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>تاریخ</TableHead>
                <TableHead className="text-end">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedback.map((row) => (
                <TableRow key={row.id} className="group">
                  <TableCell>
                    <UserCell user={row.user} userId={row.userId} />
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate text-muted-foreground">
                    {row.message.slice(0, 80)}
                    {row.message.length > 80 ? "…" : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1.5">
                      <span
                        aria-hidden
                        className={`size-1.5 rounded-full ${kindDot[row.kind] ?? "bg-muted-foreground/50"}`}
                      />
                      {kindLabel[row.kind] ?? row.kind}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1.5">
                      <span
                        aria-hidden
                        className={`size-1.5 rounded-full ${statusDot[row.status] ?? "bg-muted-foreground/50"}`}
                      />
                      {statusLabel[row.status] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <FeedbackTime date={row.createdAt} />
                  </TableCell>
                  <TableCell className="text-end">
                    <ResponsiveMenu>
                      <ResponsiveMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </ResponsiveMenuTrigger>
                      <ResponsiveMenuContent>
                        <ResponsiveMenuItem onClick={() => setSelected(row)}>
                          <Eye className="size-4" />
                          مشاهده جزئیات
                        </ResponsiveMenuItem>
                        <ResponsiveMenuSeparator />
                        <ResponsiveMenuItem
                          variant="destructive"
                          onClick={() => setDeleteId(row.id)}
                        >
                          <Trash2 className="size-4" />
                          حذف
                        </ResponsiveMenuItem>
                      </ResponsiveMenuContent>
                    </ResponsiveMenu>
                    <ResponsiveAlertDialog
                      open={deleteId === row.id}
                      onOpenChange={(o) => !o && setDeleteId(null)}
                    >
                      <ResponsiveAlertDialogContent>
                        <ResponsiveAlertDialogHeader>
                          <ResponsiveAlertDialogTitle>
                            حذف بازخورد؟
                          </ResponsiveAlertDialogTitle>
                          <ResponsiveAlertDialogDescription>
                            این عمل قابل بازگشت نیست.
                          </ResponsiveAlertDialogDescription>
                        </ResponsiveAlertDialogHeader>
                        <ResponsiveAlertDialogFooter>
                          <ResponsiveAlertDialogCancel>
                            انصراف
                          </ResponsiveAlertDialogCancel>
                          <ResponsiveAlertDialogAction
                            variant="destructive"
                            onClick={() => {
                              if (deleteId) remove.mutate(deleteId)
                              setDeleteId(null)
                            }}
                          >
                            حذف
                          </ResponsiveAlertDialogAction>
                        </ResponsiveAlertDialogFooter>
                      </ResponsiveAlertDialogContent>
                    </ResponsiveAlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Detail dialog - p-4 for content only, header/footer keep their own padding, status changeable, user link */}
        <ResponsiveDialog
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
        >
          <ResponsiveDialogPopup>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>جزئیات بازخورد</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {selected ? kindLabel[selected.kind] : ""} •{" "}
                {selected ? statusLabel[selected.status] : ""}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            {selected && (
              <div className="space-y-4 p-4 text-sm">
                <div className="flex gap-2">
                  <Badge variant="outline" className="gap-1.5">
                    <span
                      className={`size-1.5 rounded-full ${kindDot[selected.kind]}`}
                    />
                    {kindLabel[selected.kind]}
                  </Badge>
                  <Badge variant="outline" className="gap-1.5">
                    <span
                      className={`size-1.5 rounded-full ${statusDot[selected.status]}`}
                    />
                    {statusLabel[selected.status]}
                  </Badge>
                </div>
                <p className="rounded-lg bg-muted p-3 break-words whitespace-pre-wrap">
                  {selected.message}
                </p>

                {/* User full detail - avatar, fullname, id, university profile, link to user detail */}
                {selected.user ? (
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/users/${selected.user!.id}`)
                      setSelected(null)
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors hover:bg-accent"
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarImage
                        src={
                          usersService.avatarUrl(selected.user.photoUrl) ??
                          selected.user.photoUrl ??
                          undefined
                        }
                        alt={selected.user.firstName}
                      />
                      <AvatarFallback>
                        {(selected.user.firstName?.[0] ?? "") +
                          (selected.user.lastName?.[0] ?? "") || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {[selected.user.firstName, selected.user.lastName]
                          .filter(Boolean)
                          .join(" ") || selected.user.firstName}
                      </p>
                      <p
                        className="truncate text-right text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {selected.user.telegramUsername
                          ? `@${selected.user.telegramUsername} • ${selected.user.id}`
                          : String(selected.user.id)}
                      </p>
                      {selected.user.profile && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {selected.user.profile.universityName ??
                            selected.user.profile.universitySlug ??
                            "—"}
                          {selected.user.profile.majorName
                            ? ` • ${selected.user.profile.majorName}`
                            : selected.user.profile.majorSlug
                              ? ` • ${selected.user.profile.majorSlug}`
                              : ""}
                          {selected.user.profile.degree
                            ? ` • ${selected.user.profile.degree}`
                            : ""}
                          {selected.user.profile.entryYearRange
                            ? ` • ${selected.user.profile.entryYearRange}`
                            : ""}
                        </p>
                      )}
                    </div>
                    <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    کاربر: <span dir="ltr">{String(selected.userId)}</span>
                  </p>
                )}

                <div className="text-xs text-muted-foreground">
                  تاریخ:{" "}
                  {formatDate(
                    new Date(selected.createdAt),
                    "yyyy/MM/dd HH:mm",
                    {
                      calendarType: "shamsi",
                    }
                  )}
                  {selectedAgo ? (
                    <span className="ms-2">• {selectedAgo}</span>
                  ) : null}
                </div>
              </div>
            )}
            <ResponsiveDialogFooter>
              <ResponsiveDialogClose
                render={<Button variant="outline">بستن</Button>}
              />
              {selected?.status === "OPEN" ? (
                <Button
                  variant="default"
                  onClick={() => {
                    if (selected) resolve.mutate(selected.id)
                    setSelected(null)
                  }}
                  disabled={resolve.isPending}
                >
                  حل‌شده
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selected) reopen.mutate(selected.id)
                    setSelected(null)
                  }}
                  disabled={reopen.isPending}
                >
                  بازگشایی
                </Button>
              )}
            </ResponsiveDialogFooter>
          </ResponsiveDialogPopup>
        </ResponsiveDialog>

        {/* Pagination 10 per page */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              صفحه {pagination.page.toLocaleString("fa-IR")} از{" "}
              {totalPages.toLocaleString("fa-IR")} •{" "}
              {pagination.total.toLocaleString("fa-IR")} مورد
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(1)}
              >
                اولی
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight className="size-4" />
                قبلی
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                بعدی
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                آخری
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
