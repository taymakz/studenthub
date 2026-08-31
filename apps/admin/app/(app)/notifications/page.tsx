"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { parseAsString, useQueryState } from "nuqs"
import {
  Bell,
  CheckCheck,
  Megaphone,
  Play,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toastManager } from "@workspace/ui/components/toast"
import { Progress } from "@workspace/ui/components/progress"
import { apiClient } from "@/lib/api/client"

import { PageHeader } from "@/components/page-header"
import { useAuth } from "@/hooks/use-auth"
import {
  notificationsService,
  type NotificationBatch,
} from "@/services/notifications.service"
import { telegramService } from "@/services/telegram.service"
import {
  TelegramComposer,
  type ComposerValue,
} from "@/components/telegram/telegram-composer"
import { FilterSelect, ALL } from "@/components/notifications/filter-select"
import {
  GreetingConfig,
  GreetingConfigCompact,
} from "@/components/notifications/greeting-config"

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  READY: "آماده",
  SENDING: "در حال ارسال",
  COMPLETED: "تکمیل شده",
}

function BatchCard({
  batch,
  onSendNext,
  onDelete,
  onDismiss,
  onStop,
  isLoading,
}: {
  batch: NotificationBatch
  onSendNext: (id: string) => void
  onDelete: (id: string) => void
  onDismiss: (id: string) => void
  onStop: (id: string) => void
  isLoading: boolean
}) {
  const attempted = batch.sentCount + batch.failedCount
  const progress =
    batch.totalMessages > 0 ? (attempted / batch.totalMessages) * 100 : 0
  const isReady = batch.status === "READY"
  const isSending = batch.status === "SENDING"
  const isCompleted = batch.status === "COMPLETED"
  const payload = batch.payload as {
    diffId?: string
    added?: number
    removed?: number
    changed?: number
  } | null
  const hasDiff = Boolean(payload?.diffId)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm leading-tight">
              {batch.title}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {batch.type === "COURSE_CHANGES" ? "تغییرات دروس" : "همگانی"} •{" "}
              {new Date(batch.createdAt).toLocaleDateString("fa-IR")} •{" "}
              {batch.totalMessages.toLocaleString("fa-IR")} گیرنده
              {hasDiff &&
                payload &&
                (payload.added !== undefined ||
                  payload.changed !== undefined) && (
                  <span className="ms-1">
                    • {payload.added ?? 0} جدید، {payload.removed ?? 0} حذف،{" "}
                    {payload.changed ?? 0} تغییر
                  </span>
                )}
            </p>
            {hasDiff && (
              <p
                className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70"
                dir="ltr"
              >
                {payload?.diffId?.slice(0, 8)}
              </p>
            )}
          </div>
          <Badge
            variant="outline"
            className={
              isCompleted
                ? "border-success/20 bg-success/10 text-success"
                : isSending
                  ? "border-amber-200 bg-amber-100 text-amber-700"
                  : "bg-muted"
            }
          >
            {STATUS_LABEL[batch.status] ?? batch.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">پیشرفت</span>
            <span className="flex items-center gap-1.5 font-mono">
              <span>
                {attempted}/{batch.totalMessages}
              </span>
              {batch.failedCount > 0 && (
                <span className="font-sans text-[11px] text-destructive">
                  • {batch.failedCount.toLocaleString("fa-IR")} ناموفق
                </span>
              )}
              {isCompleted && attempted > 0 && (
                <span className="font-sans text-[11px] text-muted-foreground">
                  • {batch.sentCount.toLocaleString("fa-IR")} موفق
                </span>
              )}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(isReady || isSending) && (
            <>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => onSendNext(batch.id)}
                disabled={isLoading}
                loading={isLoading}
              >
                {!isLoading && <Play className="size-3.5" />}
                {isLoading
                  ? "در حال ارسال..."
                  : isSending
                    ? "ادامه"
                    : "شروع ارسال"}
              </Button>
              {isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onStop(batch.id)}
                >
                  <Square className="size-3.5" /> توقف
                </Button>
              )}
            </>
          )}
          {(isReady || isSending) && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-destructive hover:text-destructive"
              onClick={() => onDelete(batch.id)}
            >
              <Trash2 className="size-3.5" /> حذف
            </Button>
          )}
          {/* Dismiss hides by UUID - after complete the batch never shows again, also for old batches without diffId via delete */}
          {(hasDiff || isCompleted) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onDismiss(batch.id)}
            >
              <CheckCheck className="size-3.5" /> مخفی کردن
            </Button>
          )}
          {isCompleted && !hasDiff && (
            <span className="hidden py-1 text-xs text-muted-foreground">
              تکمیل شده
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function NotificationsPage() {
  const { user } = useAuth() as unknown as { user: { role: string } | null }
  const isNotificationer = user?.role === "NOTIFICATIONER"
  const canBroadcast = !isNotificationer // notificationer only detect, not broadcast
  const qc = useQueryClient()

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("changes")
  )
  // URL is English: ?tab=changes | ?tab=announcements (also handle legacy Persian ?tab=همگانی)
  const activeTab = (
    tab === "announcements" || (tab as string) === "همگانی"
      ? "announcements"
      : "changes"
  ) as "changes" | "announcements"

  const {
    data: batches = [],
    refetch: refetchBatches,
    isLoading: batchesLoading,
  } = useQuery({
    queryKey: ["admin", "batches", activeTab],
    queryFn: () =>
      notificationsService.batches(
        activeTab === "changes" ? "COURSE_CHANGES" : "ANNOUNCEMENT"
      ),
  })

  // Manual bulk check – no auto on mount to avoid duplicates on every reload
  const detectAllMut = useMutation({
    mutationFn: () =>
      notificationsService.detectAll({
        includeGreeting: courseIncludeGreeting,
        greetingTemplate: courseIncludeGreeting ? courseGreetingTemplate : null,
        includeButton: courseIncludeButton,
      }),
    onSuccess: (data) => {
      toastManager.add({
        title: "بررسی تمام شد",
        description: `${data.created} دسته جدید از ${data.total} ترم`,
        type: "success",
      })
      qc.invalidateQueries({ queryKey: ["admin", "batches"] })
    },
    onError: (e: unknown) =>
      toastManager.add({
        title: "خطا",
        description: e instanceof Error ? e.message : "بررسی ناموفق",
        type: "error",
      }),
  })

  const [sendingIds, setSendingIds] = React.useState<Set<string>>(new Set())
  const abortRef = React.useRef<Map<string, boolean>>(new Map())

  const handleSend = React.useCallback(
    async (batchId: string) => {
      if (sendingIds.has(batchId)) return
      setSendingIds((prev) => new Set(prev).add(batchId))
      abortRef.current.set(batchId, false)
      let totalSent = 0
      let totalFailed = 0
      try {
        while (!abortRef.current.get(batchId)) {
          const result: any = await notificationsService
            .sendBatch(batchId, 30)
            .catch(() => null)
          qc.invalidateQueries({ queryKey: ["admin", "batches"] })
          if (result) {
            totalSent += result.sent ?? 0
            totalFailed += result.failed ?? 0
          }
          if (!result || result.done) {
            if (result?.done) {
              const failedText =
                totalFailed > 0
                  ? `، ${totalFailed.toLocaleString("fa-IR")} ناموفق`
                  : ""
              toastManager.add({
                title: "ارسال تکمیل شد",
                description: `${totalSent.toLocaleString("fa-IR")} موفق${failedText} — همگانی و تغییرات`,
                type: totalFailed ? "warning" : "success",
              })
            }
            break
          }
          if (result.remaining === 0) break
          await new Promise((res) => setTimeout(res, 1000))
        }
      } catch (e) {
        toastManager.add({
          title: "خطا",
          description: e instanceof Error ? e.message : "ارسال ناموفق",
          type: "error",
        })
      } finally {
        setSendingIds((prev) => {
          const next = new Set(prev)
          next.delete(batchId)
          return next
        })
        abortRef.current.delete(batchId)
        qc.invalidateQueries({ queryKey: ["admin", "batches"] })
      }
    },
    [qc, sendingIds]
  )

  const handleStop = React.useCallback((batchId: string) => {
    abortRef.current.set(batchId, true)
    setSendingIds((prev) => {
      const next = new Set(prev)
      next.delete(batchId)
      return next
    })
  }, [])

  const deleteMut = useMutation({
    mutationFn: (batchId: string) => notificationsService.removeBatch(batchId),
    onSuccess: () => {
      toastManager.add({ title: "حذف شد", type: "success" })
      qc.invalidateQueries({ queryKey: ["admin", "batches"] })
    },
    onError: (e: unknown) =>
      toastManager.add({
        title: "خطا",
        description: e instanceof Error ? e.message : "حذف ناموفق",
        type: "error",
      }),
  })

  const dismissMut = useMutation({
    mutationFn: (batchId: string) => notificationsService.dismissBatch(batchId),
    onSuccess: () => {
      toastManager.add({
        title: "انجام شد",
        description: "دیگر نمایش داده نمی‌شود",
        type: "success",
      })
      qc.invalidateQueries({ queryKey: ["admin", "batches"] })
    },
    onError: (e: unknown) =>
      toastManager.add({
        title: "خطا",
        description: e instanceof Error ? e.message : "عملیات ناموفق",
        type: "error",
      }),
  })

  // Broadcast composer
  const [composer, setComposer] = React.useState<ComposerValue>({
    text: "",
    parseMode: "MarkdownV2",
    photoUrl: "",
    photoFile: null,
    photoFileId: "",
    videoUrl: "",
    videoFile: null,
    videoFileId: "",
    documentFile: null,
    documentFileId: "",
    buttons: [],
    disablePreview: true,
  })
  const [broadcastSending, setBroadcastSending] = React.useState(false)
  // Advanced audience filter for همگانی — all multi-select, default "همه"
  const [filterUni, setFilterUni] = React.useState<string[]>([ALL])
  const [filterMajor, setFilterMajor] = React.useState<string[]>([ALL])
  const [filterGender, setFilterGender] = React.useState<string[]>([ALL])
  const [filterEntrySemester, setFilterEntrySemester] = React.useState<
    string[]
  >([ALL])
  const [filterEntryYears, setFilterEntryYears] = React.useState<string[]>([
    ALL,
  ])

  const yearOptions = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(1400 + i)),
    []
  )

  const [broadcastIncludeGreeting, setBroadcastIncludeGreeting] =
    React.useState(true)
  const [broadcastGreetingTemplate, setBroadcastGreetingTemplate] =
    React.useState("سلام {name} عزیز")
  const [broadcastIncludeButton, setBroadcastIncludeButton] =
    React.useState(true)
  const [courseIncludeGreeting, setCourseIncludeGreeting] = React.useState(true)
  const [courseGreetingTemplate, setCourseGreetingTemplate] =
    React.useState("سلام {name} عزیز")
  const [courseIncludeButton, setCourseIncludeButton] = React.useState(true)

  const { data: uniList = [] } = useQuery({
    queryKey: ["admin", "meta", "universities"],
    queryFn: async () => {
      const res = await apiClient.get<{
        universities: Array<{ slug: string; name: { fa: string } }>
      }>("/admin/meta/universities")
      return (res.data as any).universities ?? res.data
    },
  })
  const { data: majorList = [] } = useQuery({
    queryKey: ["admin", "meta", "majors", filterUni],
    queryFn: async () => {
      const uniParam = filterUni.includes(ALL) ? "" : filterUni.join(",")
      const qs = uniParam ? `?uni=${uniParam}` : ""
      const res = await apiClient.get<{
        majors: Array<{ slug: string; name: { fa: string }; uniSlug: string }>
      }>(`/admin/meta/majors${qs}`)
      const raw: Array<{
        slug: string
        name: { fa: string }
        uniSlug: string
      }> = (res.data as any).majors ?? (res.data as any) ?? []
      // Deduplicate shared majors like "مهندسی کامپیوتر" that exist in multiple universities — show once, selecting it targets all CE in all universities
      const bySlug = new Map<string, (typeof raw)[number]>()
      for (const m of raw) if (!bySlug.has(m.slug)) bySlug.set(m.slug, m)
      return Array.from(bySlug.values()).sort((a, b) =>
        a.name.fa.localeCompare(b.name.fa, "fa")
      )
    },
  })

  const handleBroadcast = async () => {
    if (!composer.text.trim()) {
      toastManager.add({
        title: "خطا",
        description: "متن الزامی است",
        type: "error",
      })
      return
    }
    setBroadcastSending(true)
    try {
      const buttons = composer.buttons
        .map((r) =>
          r
            .filter((b) => b.text.trim() && b.url.trim())
            .map((b) => ({ text: b.text.trim(), url: b.url.trim() }))
        )
        .filter((r) => r.length > 0)
      const toArrayOrUndefined = (arr: string[]) =>
        arr.includes(ALL) || arr.length === 0 ? undefined : arr
      const uniVals = toArrayOrUndefined(filterUni)
      const majorVals = toArrayOrUndefined(filterMajor)
      const genderVals = toArrayOrUndefined(filterGender)
      const semesterVals = toArrayOrUndefined(filterEntrySemester)
      const yearVals = toArrayOrUndefined(filterEntryYears)
        ?.map(Number)
        .filter((n) => Number.isFinite(n))
      if (uniVals && uniVals.length > 10) {
        toastManager.add({ title: "حداکثر ۱۰ دانشگاه", type: "error" })
        setBroadcastSending(false)
        return
      }
      if (majorVals && majorVals.length > 10) {
        toastManager.add({ title: "حداکثر ۱۰ رشته", type: "error" })
        setBroadcastSending(false)
        return
      }
      if (genderVals && genderVals.length > 2) {
        toastManager.add({ title: "حداکثر ۲ جنسیت", type: "error" })
        setBroadcastSending(false)
        return
      }
      if (semesterVals && semesterVals.length > 3) {
        toastManager.add({ title: "حداکثر ۳ ترم ورود", type: "error" })
        setBroadcastSending(false)
        return
      }
      if (yearVals && yearVals.length > 10) {
        toastManager.add({ title: "حداکثر ۱۰ سال ورود", type: "error" })
        setBroadcastSending(false)
        return
      }
      await telegramService.sendBroadcast({
        text: composer.text.trim(),
        parseMode:
          composer.parseMode === "plain"
            ? undefined
            : (composer.parseMode as "HTML" | "Markdown" | "MarkdownV2"),
        photoUrl: composer.photoUrl.trim() || undefined,
        photoFile: composer.photoFile ?? undefined,
        photoFileId: composer.photoFileId.trim() || undefined,
        videoUrl: composer.videoUrl.trim() || undefined,
        videoFile: composer.videoFile ?? undefined,
        videoFileId: composer.videoFileId.trim() || undefined,
        documentFile: composer.documentFile ?? undefined,
        documentFileId: composer.documentFileId.trim() || undefined,
        buttons: buttons.length ? buttons : undefined,
        disablePreview: composer.disablePreview,
        includeGreeting: broadcastIncludeGreeting,
        greetingTemplate: broadcastIncludeGreeting
          ? broadcastGreetingTemplate
          : undefined,
        includeButton: broadcastIncludeButton,
        // Single-value fallback for backward compat
        universitySlug: uniVals?.[0],
        majorSlug: majorVals?.[0],
        gender: (genderVals?.[0] as any) ?? undefined,
        entrySemester: (semesterVals?.[0] as any) ?? undefined,
        entryYears: yearVals?.length ? yearVals : undefined,
        // Multi-value extended
        universitySlugs: uniVals as any,
        majorSlugs: majorVals as any,
        genders: genderVals as any,
        entrySemesters: semesterVals as any,
      } as any)
      toastManager.add({
        title: "اعلان ساخته شد",
        description: "با «شروع ارسال» به صورت مرحله‌ای ارسال می‌شود",
        type: "success",
      })
      setComposer({
        text: "",
        parseMode: "MarkdownV2",
        photoUrl: "",
        photoFile: null,
        photoFileId: "",
        videoUrl: "",
        videoFile: null,
        videoFileId: "",
        documentFile: null,
        documentFileId: "",
        buttons: [],
        disablePreview: true,
      })
      qc.invalidateQueries({ queryKey: ["admin", "batches"] })
      setTab("announcements")
    } catch (e: unknown) {
      toastManager.add({
        title: "خطا",
        description: e instanceof Error ? e.message : "ایجاد ناموفق",
        type: "error",
      })
    } finally {
      setBroadcastSending(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="اعلان‌ها">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => refetchBatches()}
        >
          <RefreshCw className="size-3.5" /> بروزرسانی
        </Button>
      </PageHeader>

      <div className="space-y-6 p-4 lg:p-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setTab(v as string)}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="changes" className="gap-1.5">
              <Bell className="size-3.5" /> تغییرات دروس
            </TabsTrigger>
            <TabsTrigger
              value="announcements"
              className="gap-1.5"
              disabled={isNotificationer}
            >
              <Megaphone className="size-3.5" /> همگانی{" "}
              {isNotificationer && "(غیر مجاز)"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="changes" className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">تشخیص تغییرات ارائه</CardTitle>
                <p className="text-xs text-muted-foreground">
                  به صورت خودکار همه ترم‌ها بررسی می‌شوند — new.json در برابر
                  old.json، سریع و موازی
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <GreetingConfigCompact
                  include={courseIncludeGreeting}
                  setInclude={setCourseIncludeGreeting}
                  template={courseGreetingTemplate}
                  setTemplate={setCourseGreetingTemplate}
                  includeButton={courseIncludeButton}
                  setIncludeButton={setCourseIncludeButton}
                  idPrefix="cc"
                  greetingLabel="ارسال با سلام شخصی‌سازی شده برای تغییرات دروس"
                  buttonLabel="نمایش دکمه «اجرای برنامه» در تغییرات"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {detectAllMut.isPending
                      ? "در حال بررسی همه ترم‌ها..."
                      : "برای ایجاد دسته‌های جدید بر اساس diff.json بررسی را بزنید — هر new.json فقط یک diff با UUID دارد"}
                  </p>
                  <Button
                    onClick={() => detectAllMut.mutate()}
                    disabled={detectAllMut.isPending}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                  >
                    {detectAllMut.isPending
                      ? "در حال بررسی..."
                      : "بررسی مجدد همه"}
                  </Button>
                </div>
                {detectAllMut.isPending && (
                  <Progress value={50} className="h-1.5 animate-pulse" />
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">دسته‌های تغییرات دروس</h3>
              {batchesLoading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  در حال بارگذاری...
                </p>
              ) : batches.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  دسته‌ای وجود ندارد — «بررسی مجدد همه» را بزنید تا diffهای جدید
                  ساخته شوند
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {batches.map((b) => (
                    <BatchCard
                      key={b.id}
                      batch={b}
                      onSendNext={handleSend}
                      onDelete={(id) => deleteMut.mutate(id)}
                      onDismiss={(id) => dismissMut.mutate(id)}
                      onStop={handleStop}
                      isLoading={sendingIds.has(b.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="announcements" className="mt-6 space-y-6">
            {isNotificationer ? (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  دسترسی به بخش همگانی فقط برای ادمین و سوپرادمین است
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
                {/* Left: Composer Studio */}
                <div className="space-y-6">
                  <Card className="overflow-hidden shadow-sm">
                    <CardHeader className="pb-4">
                      <div>
                        <CardTitle className="text-[15px] leading-none">
                          استودیو پیام همگانی
                        </CardTitle>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          پیام حرفه‌ای با پیش‌نمایش زنده — فیلتر دقیق، شخصی‌سازی
                          و زمان‌بندی ۳۰/ثانیه
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="size-2 animate-pulse rounded-full bg-emerald-500" />
                            <h4 className="text-sm font-medium">
                              فیلتر مخاطبان — چندانتخابی
                            </h4>
                            <span className="hidden text-xs text-muted-foreground sm:inline">
                              همه = بدون فیلتر
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setFilterUni([ALL])
                              setFilterMajor([ALL])
                              setFilterGender([ALL])
                              setFilterEntrySemester([ALL])
                              setFilterEntryYears([ALL])
                            }}
                          >
                            پاک کردن
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <FilterSelect
                            label="دانشگاه"
                            value={filterUni}
                            onChange={(nv) => {
                              setFilterUni(nv)
                              if (!nv.includes(ALL) && nv.length)
                                setFilterMajor([ALL])
                            }}
                            items={[
                              ALL,
                              ...(uniList as any[]).map((u: any) => u.slug),
                            ]}
                            getLabel={(item) => {
                              if (item === ALL) return ALL
                              const uni = (uniList as any[]).find(
                                (u) => u.slug === item
                              )
                              return uni?.name?.fa ?? item
                            }}
                          />
                          <FilterSelect
                            label="رشته"
                            value={filterMajor}
                            onChange={setFilterMajor}
                            items={[
                              ALL,
                              ...(majorList as any[]).map((m: any) => m.slug),
                            ]}
                            getLabel={(item) => {
                              if (item === ALL) return ALL
                              const major = (majorList as any[]).find(
                                (m) => m.slug === item
                              )
                              return major?.name?.fa ?? item
                            }}
                          />
                          <FilterSelect
                            label="جنسیت"
                            value={filterGender}
                            onChange={setFilterGender}
                            items={[ALL, "MALE", "FEMALE"]}
                            getLabel={(item) =>
                              item === ALL
                                ? ALL
                                : item === "MALE"
                                  ? "پسر"
                                  : "دختر"
                            }
                          />
                          <FilterSelect
                            label="ترم ورود"
                            value={filterEntrySemester}
                            onChange={setFilterEntrySemester}
                            items={[ALL, "MEHR", "BAHMAN", "SUMMER"]}
                            getLabel={(item) =>
                              item === ALL
                                ? ALL
                                : item === "MEHR"
                                  ? "مهر"
                                  : item === "BAHMAN"
                                    ? "بهمن"
                                    : "تابستان"
                            }
                          />
                          <div className="sm:col-span-2">
                            <FilterSelect
                              label="سال ورود"
                              value={filterEntryYears}
                              onChange={setFilterEntryYears}
                              items={[ALL, ...yearOptions]}
                            />
                          </div>
                        </div>
                      </div>
                      <GreetingConfig
                        include={broadcastIncludeGreeting}
                        setInclude={setBroadcastIncludeGreeting}
                        template={broadcastGreetingTemplate}
                        setTemplate={setBroadcastGreetingTemplate}
                        includeButton={broadcastIncludeButton}
                        setIncludeButton={setBroadcastIncludeButton}
                        idPrefix="bc"
                        greetingLabel="سلام شخصی‌سازی شده"
                        buttonLabel="دکمه «اجرای برنامه»"
                        showHint
                      />
                      <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/[0.03] p-2">
                        <TelegramComposer
                          value={composer}
                          onChange={setComposer}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-muted-foreground">
                          {composer.text.trim().length > 0
                            ? `${composer.text.trim().length} حرف • Vazir`
                            : "متن را بنویسید — پیش‌نمایش زنده در سمت چپ"}
                        </p>
                        <Button
                          onClick={handleBroadcast}
                          disabled={broadcastSending || !composer.text.trim()}
                          className="min-w-32 shadow-md"
                          size="lg"
                        >
                          {broadcastSending
                            ? "در حال ایجاد..."
                            : "ایجاد دسته همگانی"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="size-2 animate-pulse rounded-full bg-primary" />
                      <span className="font-medium">دسته‌های همگانی</span>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {batches.length.toLocaleString("fa-IR")}
                      </Badge>
                    </div>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      ۳۰ پیام/ثانیه • توقف‌پذیر
                    </span>
                  </div>
                  {batches.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="p-10 text-center">
                        <p className="text-sm text-muted-foreground">
                          هنوز دسته‌ای نساخته‌اید — بالا پیام را بسازید
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {batches.map((b) => (
                        <BatchCard
                          key={b.id}
                          batch={b}
                          onSendNext={handleSend}
                          onDelete={(id) => deleteMut.mutate(id)}
                          onDismiss={(id) => dismissMut.mutate(id)}
                          onStop={handleStop}
                          isLoading={sendingIds.has(b.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Live Preview - Sticky */}
                <div className="space-y-4 xl:sticky xl:top-6 xl:h-fit">
                  <Card className="overflow-hidden border-0 shadow-xl">
                    <div className="flex items-center gap-3 bg-gradient-to-br from-zinc-900 to-zinc-800 p-3 text-white">
                      <div className="flex size-8 items-center justify-center rounded-full bg-white/10">
                        ◈
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm leading-none font-medium">
                          پیش‌نمایش زنده
                        </p>
                      </div>
                      <Badge className="ms-auto border-white/10 bg-white/10 text-white">
                        همگانی
                      </Badge>
                    </div>
                    <CardContent className="p-0">
                      <div className="bg-[#e7f0e4] p-4 dark:bg-[#0f1a12]">
                        <div className="mx-auto max-w-[360px]">
                          <div className="overflow-hidden rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
                            {(composer.photoFile ||
                              composer.photoUrl ||
                              composer.photoFileId ||
                              composer.videoFile ||
                              composer.videoUrl ||
                              composer.videoFileId ||
                              composer.documentFile ||
                              composer.documentFileId) && (
                              <div className="flex items-center gap-3 bg-muted p-3">
                                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-xs text-primary">
                                  رسانه
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-sans text-xs font-medium">
                                    پیش‌نمایش رسانه
                                  </p>
                                  <p className="font-sans text-[10px] text-muted-foreground">
                                    تا ۴MB
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className="px-4 py-3">
                              {broadcastIncludeGreeting ? (
                                <p
                                  className="font-sans text-[13px] leading-6 break-words whitespace-pre-wrap"
                                  dir="auto"
                                  style={{ fontFamily: "var(--font-sans)" }}
                                >
                                  {broadcastGreetingTemplate.replace(
                                    "{name}",
                                    "دانشجوی عزیز"
                                  )}
                                  <span className="text-muted-foreground">
                                    {"\n\n"}
                                  </span>
                                  {composer.text.trim() || (
                                    <span className="text-muted-foreground">
                                      متن پیام اینجا نمایش داده می‌شود…
                                    </span>
                                  )}
                                </p>
                              ) : (
                                <p
                                  className="font-sans text-[13px] leading-6 break-words whitespace-pre-wrap"
                                  dir="auto"
                                  style={{ fontFamily: "var(--font-sans)" }}
                                >
                                  {composer.text.trim() || (
                                    <span className="text-muted-foreground">
                                      متن پیام اینجا نمایش داده می‌شود…
                                    </span>
                                  )}
                                </p>
                              )}
                              {composer.buttons.length > 0 &&
                                composer.buttons.some((r) =>
                                  r.some((b) => b.text.trim())
                                ) && (
                                  <div className="mt-3 grid gap-1.5">
                                    {composer.buttons.map((row, ri) => (
                                      <div
                                        key={ri}
                                        className="grid gap-1.5"
                                        style={{
                                          gridTemplateColumns: `repeat(${row.length}, minmax(0,1fr))`,
                                        }}
                                      >
                                        {row.map((b, ci) =>
                                          b.text.trim() ? (
                                            <span
                                              key={ci}
                                              className="truncate rounded-full bg-[#e8f0fe] px-3 py-1.5 text-center font-sans text-xs font-medium text-[#0b57d0] dark:bg-zinc-800 dark:text-zinc-100"
                                            >
                                              {b.text}
                                            </span>
                                          ) : null
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              {broadcastIncludeButton && (
                                <div className="mt-3">
                                  <span className="block w-full rounded-full bg-[#e8f0fe] px-3 py-2 text-center font-sans text-xs font-medium text-[#0b57d0] dark:bg-zinc-800 dark:text-zinc-100">
                                    اجرای برنامه
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="mt-3 text-center font-sans text-[11px] text-muted-foreground">
                            ۳۰ پیام در ثانیه • هر ۳۰ با یک تراکنش ذخیره می‌شود
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
