"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  Clock,
  Eye,
  GraduationCap,
  Handshake,
  Hash,
  Mail,
  MoreHorizontal,
  Search,
  Send,
  Shield,
  ShieldCheck,
  UserCog,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
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
import {
  groupAndSortCoursesByWeekDay,
  groupCoursesByExamDate,
  calcGraduateProgress,
  type ScheduleCourse,
} from "@workspace/ui/lib/schedule"

import { PageHeader } from "@/components/page-header"
import {
  usersService,
  type AdminRole,
  type PublicUser,
} from "@/services/users.service"
import { SendMessageDialog } from "@/components/telegram/send-message-dialog"
import { useAuth } from "@/hooks/use-auth"

const ROLE_LABEL: Record<AdminRole, string> = {
  SUPERADMIN: "سوپرادمین",
  ADMIN: "ادمین",
  NOTIFICATIONER: "اطلاع‌رسان",
  USER: "کاربر",
}
const ROLE_BADGE_CLASS: Record<AdminRole, string> = {
  SUPERADMIN: "bg-destructive/10 text-destructive border-destructive/20",
  ADMIN: "bg-primary/10 text-primary border-primary/20",
  NOTIFICATIONER:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  USER: "bg-muted text-muted-foreground border-border",
}

// Inline graduate progress card for admin (read-only)
function GraduateProgressCard({
  profile,
  passed,
  chartCourses,
}: {
  profile: {
    universitySlug: string | null
    majorSlug: string | null
    degree: string | null
    entryYearRange: string | null
    entrySemester: string | null
  } | null
  passed: { courseName: string }[]
  chartCourses: ScheduleCourse[]
}) {
  const isComplete =
    profile?.universitySlug &&
    profile?.majorSlug &&
    profile?.degree &&
    profile?.entryYearRange &&
    profile?.entrySemester
  if (!isComplete || chartCourses.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          پروفایل دانشگاهی کامل نیست — امکان محاسبه پیشرفت تحصیلی وجود ندارد.
          <br />
          <span className="text-xs">
            دانشگاه، رشته، مقطع، سال ورود و ترم ورود باید تکمیل باشد.
          </span>
        </CardContent>
      </Card>
    )
  }

  const passedNames = new Set(passed.map((p) => p.courseName))
  const { totalRequired, passedUnits, remaining, percent } =
    calcGraduateProgress(chartCourses, passedNames)

  const getProgressColor = () => {
    if (percent > 80) return "bg-primary"
    if (percent > 60) return "bg-emerald-500"
    if (percent >= 40) return "bg-orange-500"
    if (percent >= 20) return "bg-yellow-500"
    if (percent > 0) return "bg-destructive"
    return "bg-secondary"
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="size-5 text-muted-foreground" />
          پیشرفت تحصیلی
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {remaining} واحد تا فارغ‌التحصیلی
          </span>
          <span className="text-xs text-muted-foreground">
            {totalRequired} / {passedUnits}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary" dir="ltr">
          <div
            className={cn(
              "h-1.5 rounded-full transition-all",
              getProgressColor()
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-muted-foreground">کل واحد</p>
            <p className="mt-1 text-lg font-semibold">{totalRequired}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-muted-foreground">پاس شده</p>
            <p className="mt-1 text-lg font-semibold text-success">
              {passedUnits}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-muted-foreground">باقی‌مانده</p>
            <p className="mt-1 text-lg font-semibold text-primary">
              {remaining}
            </p>
          </div>
        </div>

        <Drawer>
          <DrawerTrigger
            render={
              <Button variant="outline" className="w-full">
                مشاهده جزئیات دروس
              </Button>
            }
          />
          <DrawerPopup variant="inset">
            <DrawerHeader>
              <DrawerTitle>جزئیات دروس چارت</DrawerTitle>
              <DrawerDescription>
                لیست دروس پاس شده و باقی‌مانده
              </DrawerDescription>
            </DrawerHeader>
            <DrawerPanel>
              <ScrollArea className="max-h-[50dvh] px-6">
                <div className="space-y-4 py-4">
                  {chartCourses.map((c, i) => {
                    const passed = passedNames.has(c.course_name)
                    return (
                      <div
                        key={`${c.course_name}-${i}`}
                        className={cn(
                          "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                          passed
                            ? "border-success/30 bg-success/10 text-success"
                            : "bg-card"
                        )}
                      >
                        <span className="font-medium">{c.course_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.course_unit} واحد
                        </span>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </DrawerPanel>
          </DrawerPopup>
        </Drawer>
      </CardContent>
    </Card>
  )
}

function ScheduleDrawer({
  title,
  description,
  triggerTitle,
  courses,
  type,
}: {
  title: string
  description: string
  triggerTitle: string
  courses: ScheduleCourse[]
  type: "weekly" | "exam"
}) {
  const groupedWeekly =
    type === "weekly" ? groupAndSortCoursesByWeekDay(courses) : []
  const groupedExam = type === "exam" ? groupCoursesByExamDate(courses) : []

  return (
    <Drawer>
      <DrawerTrigger
        render={
          <button className="w-full">
            <Card className="flex flex-col items-center gap-2.5 p-6 transition-shadow hover:shadow-md">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                {type === "weekly" ? (
                  <CalendarDays className="size-8 text-muted-foreground" />
                ) : (
                  <Clock className="size-8 text-muted-foreground" />
                )}
              </div>
              <p className="text-sm font-medium">{triggerTitle}</p>
            </Card>
          </button>
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel>
          <ScrollArea className="max-h-[60dvh] px-6">
            {type === "weekly" ? (
              <div className="space-y-6 py-4">
                {groupedWeekly.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    برنامه‌ای یافت نشد
                  </p>
                ) : (
                  groupedWeekly.map((day) => (
                    <div key={day.name} className="space-y-3">
                      <h3 className="font-semibold text-success">{day.name}</h3>
                      <div className="space-y-2">
                        {day.items.map((course, i) => (
                          <div
                            key={`${course.course_name}-${course.course_code ?? i}-${i}`}
                            className="space-y-1 rounded-lg border bg-card p-3"
                          >
                            <p className="line-clamp-2 text-sm font-medium">
                              {course.course_name}
                            </p>
                            {course.class_schedule && (
                              <p className="text-xs text-muted-foreground">
                                {course.class_schedule}
                              </p>
                            )}
                            {course.professor && (
                              <p className="text-xs text-muted-foreground">
                                استاد: {course.professor}
                              </p>
                            )}
                            {course.location && (
                              <p className="text-xs text-muted-foreground">
                                محل: {course.location}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-6 py-4">
                {groupedExam.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    برنامه‌ای یافت نشد
                  </p>
                ) : (
                  groupedExam.map((group) => (
                    <div key={group.date} className="space-y-3">
                      <h3 className="text-alert font-semibold">{group.date}</h3>
                      <div className="space-y-2">
                        {group.items.map((item, i) => (
                          <div
                            key={`${item.course.course_name}-${i}`}
                            className="space-y-1 rounded-lg border bg-card p-3"
                          >
                            <p className="line-clamp-2 text-sm font-medium">
                              {item.course.course_name}
                            </p>
                            {item.startTime && item.endTime && (
                              <p className="text-xs text-muted-foreground">
                                {item.startTime} تا {item.endTime}
                              </p>
                            )}
                            {item.course.professor && (
                              <p className="text-xs text-muted-foreground">
                                استاد: {item.course.professor}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = Number(params.id)
  const [sendOpen, setSendOpen] = React.useState(false)
  const [banOpen, setBanOpen] = React.useState(false)
  const [roleOpen, setRoleOpen] = React.useState(false)
  const [searchPassed, setSearchPassed] = React.useState("")
  const { user: me } = useAuth() as unknown as { user: PublicUser | null }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "users", "detail", id],
    queryFn: () => usersService.detail(id),
    enabled: Number.isSafeInteger(id),
  })

  if (me && me.role !== "SUPERADMIN" && me.role !== "ADMIN") {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="جزئیات کاربر" />
        <div className="p-6 text-center text-sm text-muted-foreground">
          دسترسی فقط برای ادمین و سوپرادمین
        </div>
      </div>
    )
  }

  const user = data?.user as PublicUser | undefined
  const profile = data?.profile as unknown as {
    universitySlug: string | null
    majorSlug: string | null
    degree: string | null
    entryYearRange: string | null
    entrySemester: string | null
    gender: string | null
    termNumber: number | null
  } | null
  const noted = (data as unknown as { noted: unknown[] })?.noted as unknown as
    | Array<{
        courseIndex: string
        isDeleted: boolean
        universitySlug: string
        majorSlug: string
      }>
    | undefined
  const passed = (data as unknown as { passed: unknown[] })
    ?.passed as unknown as
    | Array<{
        courseName: string
        courseCode: string | null
        createdAt: string
      }>
    | undefined

  // For graduate progress we need chartCourses – if profile complete we fetch via API
  const [chartCourses, setChartCourses] = React.useState<ScheduleCourse[]>([])
  React.useEffect(() => {
    if (
      !profile?.universitySlug ||
      !profile?.majorSlug ||
      !profile?.degree ||
      !profile?.entryYearRange ||
      !profile?.entrySemester
    ) {
      setChartCourses([])
      return
    }
    let cancelled = false
    usersService
      .chart(id)
      .then((res) => {
        if (cancelled) return
        const list = (res.courses ?? []) as unknown as ScheduleCourse[]
        setChartCourses(list)
      })
      .catch(() => {
        if (!cancelled) setChartCourses([])
      })
    return () => {
      cancelled = true
    }
  }, [profile, id])

  // Only show passed/noted for the user's CURRENT university profile (each uni/major/year is isolated)
  const currentPassed = React.useMemo(() => {
    if (!passed) return []
    if (!profile?.universitySlug || !profile?.majorSlug) return []
    return (
      passed as unknown as Array<{
        courseName: string
        courseCode: string | null
        universitySlug: string
        majorSlug: string
        createdAt: string
      }>
    ).filter(
      (p) =>
        p.universitySlug === profile.universitySlug &&
        p.majorSlug === profile.majorSlug
    )
  }, [passed, profile?.universitySlug, profile?.majorSlug])

  const currentNoted = React.useMemo(() => {
    if (!noted) return []
    if (!profile?.universitySlug || !profile?.majorSlug) return []
    return noted.filter(
      (n) =>
        n.universitySlug === profile.universitySlug &&
        n.majorSlug === profile.majorSlug
    )
  }, [noted, profile?.universitySlug, profile?.majorSlug])

  const filteredPassed = React.useMemo(() => {
    if (!currentPassed) return []
    const q = searchPassed.trim().toLowerCase()
    if (!q) return currentPassed
    return currentPassed.filter((p) => p.courseName.toLowerCase().includes(q))
  }, [currentPassed, searchPassed])

  // Mock weekly/exam courses from current noted (enriched) – for now use mock data
  const weeklyCourses: ScheduleCourse[] = React.useMemo(() => {
    if (!currentNoted) return []
    return currentNoted
      .filter((n) => !n.isDeleted)
      .slice(0, 20)
      .map((n) => ({
        course_name: n.courseIndex,
        course_code: n.courseIndex,
        class_schedule: "شنبه از 08:00 تا 10:00",
        exam_schedule: "1404/03/22 از 08:00 تا 10:00",
        professor: "نامشخص",
        location: "—",
        course_unit: 3,
      }))
  }, [currentNoted])

  if (!Number.isSafeInteger(id)) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">شناسه نامعتبر</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">کاربر یافت نشد</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/users")}
        >
          بازگشت
        </Button>
      </div>
    )
  }

  const proxied = usersService.avatarUrl(user.photoUrl)

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="جزئیات کاربر">
        <Button variant="ghost" size="sm" onClick={() => router.push("/users")}>
          <ArrowLeft className="size-4" />
          بازگشت
        </Button>
      </PageHeader>

      <div className="space-y-6 p-4 lg:p-6">
        {/* Header Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <Avatar className="size-20 border-2 border-card shadow-sm sm:size-24">
                  <AvatarImage
                    src={proxied ?? undefined}
                    alt={user.firstName}
                  />
                  <AvatarFallback>{user.firstName[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">
                    {user.firstName} {user.lastName ?? ""}
                  </h2>
                  <p
                    dir="ltr"
                    className="text-left text-sm text-muted-foreground"
                  >
                    @{user.telegramUsername ?? "—"} • {user.id}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-none px-2 py-0.5 text-xs",
                        ROLE_BADGE_CLASS[user.role]
                      )}
                    >
                      {ROLE_LABEL[user.role]}
                    </Badge>
                    {user.banned && (
                      <Badge variant="destructive">مسدود شده</Badge>
                    )}
                    {user.isContributor && (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        مشارکت‌کننده
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        user.banned
                          ? "bg-destructive/10 text-destructive"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }
                    >
                      {user.banned ? "مسدود" : "فعال"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    آخرین فعالیت:{" "}
                    {user.lastOnlineAt
                      ? new Date(user.lastOnlineAt).toLocaleDateString(
                          "fa-IR",
                          { timeZone: "Asia/Tehran" }
                        )
                      : "هرگز"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                <Button onClick={() => setSendOpen(true)} className="gap-1.5">
                  <Send className="size-4" /> ارسال پیام
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRoleOpen(true)}
                    disabled={me?.id === user.id || me?.role !== "SUPERADMIN"}
                    title={
                      me?.id === user.id
                        ? "نمی‌توانید دسترسی خودتان را تغییر دهید"
                        : me?.role !== "SUPERADMIN"
                          ? "فقط سوپرادمین"
                          : undefined
                    }
                  >
                    <UserCog className="size-4" /> تغییر دسترسی
                  </Button>
                  <Button
                    variant={user.isContributor ? "default" : "outline"}
                    size="sm"
                    onClick={async () => {
                      await usersService.toggleContributor(user.id)
                      refetch()
                    }}
                  >
                    <Handshake className="size-4" />{" "}
                    {user.isContributor ? "مشارکت‌کننده" : "مشارکت"}
                  </Button>
                  {user.banned ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await usersService.unban(user.id)
                        refetch()
                      }}
                    >
                      <Shield className="size-4" /> رفع مسدودی
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setBanOpen(true)}
                    >
                      <Ban className="size-4" /> مسدود کردن
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {profile && (
              <div className="mt-6 grid gap-4 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">دانشگاه:</span>
                  <span className="font-medium">
                    {(profile as unknown as { universityName?: string | null })
                      .universityName ??
                      profile.universitySlug ??
                      "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">رشته:</span>
                  <span className="font-medium">
                    {(profile as unknown as { majorName?: string | null })
                      .majorName ??
                      profile.majorSlug ??
                      "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">مقطع:</span>
                  <span className="font-medium">
                    {(profile as unknown as { degreeName?: string | null })
                      .degreeName ??
                      profile.degree ??
                      "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">سال ورود:</span>
                  <span className="font-medium">
                    {profile.entryYearRange ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">ترم ورود:</span>
                  <span className="font-medium">
                    {(
                      profile as unknown as {
                        entrySemesterLabel?: string | null
                      }
                    ).entrySemesterLabel ??
                      profile.entrySemester ??
                      "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">ترم:</span>
                  <span className="font-medium">
                    {profile.termNumber ?? "—"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Graduate Progress */}
        <GraduateProgressCard
          profile={profile}
          passed={(passed as unknown as { courseName: string }[]) ?? []}
          chartCourses={chartCourses}
        />

        {/* Tools: Weekly & Exam */}
        <div className="grid gap-4 sm:grid-cols-2">
          <ScheduleDrawer
            title="برنامه هفتگی"
            description="لیست کلاس‌ها در طول هفته"
            triggerTitle="برنامه هفتگی"
            courses={weeklyCourses}
            type="weekly"
          />
          <ScheduleDrawer
            title="برنامه امتحانی"
            description="لیست امتحانات به ترتیب زمان"
            triggerTitle="برنامه امتحانی"
            courses={weeklyCourses}
            type="exam"
          />
        </div>

        {/* Passed courses – only for current uni/major */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                دروس پاس شده ({currentPassed.length})
              </CardTitle>
              <div className="relative w-full max-w-[260px]">
                <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="جستجو..."
                  value={searchPassed}
                  onChange={(e) => setSearchPassed(e.target.value)}
                  className="h-8 ps-8 text-sm"
                />
              </div>
            </div>
            {profile?.universitySlug && profile?.majorSlug && (
              <p className="text-xs text-muted-foreground">
                فقط دروس پاس شده برای{" "}
                <span className="font-medium text-foreground">
                  {(profile as unknown as { universityName?: string | null })
                    .universityName ?? profile.universitySlug}
                </span>{" "}
                /{" "}
                {(profile as unknown as { majorName?: string | null })
                  .majorName ?? profile.majorSlug}{" "}
                نمایش داده می‌شود
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {filteredPassed.length === 0 ? (
                <p className="w-full py-10 text-center text-sm text-muted-foreground">
                  دروسی یافت نشد
                </p>
              ) : (
                filteredPassed.map((p, i) => {
                  const unit = chartCourses.find(
                    (c) => c.course_name === p.courseName
                  )?.course_unit
                  return (
                    <div
                      key={`${p.courseName}-${(p as unknown as { courseCode?: string | null }).courseCode ?? i}-${i}`}
                      className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium">{p.courseName}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {unit ? `${unit} واحد` : "—"}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* برنامه انتخاب شده – drawer inset */}
        <Drawer>
          <DrawerTrigger
            render={
              <Button variant="outline" className="w-full justify-between">
                برنامه انتخاب شده (
                {currentNoted.filter((n) => !n.isDeleted).length}){" "}
                <Eye className="size-4" />
              </Button>
            }
          />
          <DrawerPopup variant="inset" showBar>
            <DrawerHeader>
              <DrawerTitle>برنامه انتخاب شده</DrawerTitle>
              <DrawerDescription>
                دروس انتخاب شده برای ترم جاری — فقط برای رشته/دانشگاه فعلی
              </DrawerDescription>
            </DrawerHeader>
            <DrawerPanel>
              <ScrollArea className="max-h-[60dvh] px-6">
                <div className="flex flex-wrap gap-2 py-4">
                  {currentNoted.length === 0 ? (
                    <p className="w-full py-10 text-center text-sm text-muted-foreground">
                      برنامه‌ای یافت نشد
                    </p>
                  ) : (
                    currentNoted.map((n, i) => (
                      <div
                        key={`${n.courseIndex}-${i}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs",
                          n.isDeleted && "bg-muted/30 opacity-60"
                        )}
                      >
                        <span className="font-medium">{n.courseIndex}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {n.isDeleted ? "حذف‌شده" : "فعال"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </DrawerPanel>
          </DrawerPopup>
        </Drawer>
      </div>

      <SendMessageDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        user={user}
      />

      <AlertDialog open={banOpen} onOpenChange={setBanOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>مسدود کردن {user.firstName}؟</AlertDialogTitle>
            <AlertDialogDescription>
              کاربر قادر به استفاده از سیستم نخواهد بود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await usersService.ban(user.id)
                setBanOpen(false)
                refetch()
              }}
            >
              مسدود کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={roleOpen} onOpenChange={setRoleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تغییر دسترسی</AlertDialogTitle>
            <AlertDialogDescription>
              نقش فعلی: {ROLE_LABEL[user.role]}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            {(["USER", "ADMIN", "SUPERADMIN", "NOTIFICATIONER"] as const).map(
              (r) => (
                <Button
                  key={r}
                  variant={r === user.role ? "default" : "outline"}
                  className="justify-start"
                  disabled={r === user.role}
                  onClick={async () => {
                    await usersService.setRole(user.id, r)
                    setRoleOpen(false)
                    refetch()
                  }}
                >
                  {ROLE_LABEL[r]}
                </Button>
              )
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>بستن</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
