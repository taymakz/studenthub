"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { Button } from "@workspace/ui/components/button"
import { StatusButton } from "@workspace/ui/components/status-button"
import { toastManager } from "@workspace/ui/components/toast"
import { ChevronLeft } from "lucide-react"

import { type Offering, professorName } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"
import { ToolButton } from "./tool-card"
import { CalendarExamIcon } from "./tool-icons"
import { useNotedOfferings, OfferingsEmpty } from "./use-noted-offerings"
import {
  extractDate,
  extractTimes,
  formatDaysRemainInPersian,
  formatPersianDateLong,
  getCurrentDatePersian,
  persianDateDiff,
  persianWeekDayFromDays,
} from "./schedule-util"
import { drawExportHeader, drawExportRow, exportPalette } from "./export-canvas"
import { exportImage, ExportUploadCanceled } from "@/lib/export-image"
import { CourseDetailDrawer } from "@/components/app/courses/course-detail-drawer"
import { ProfessorDrawer } from "@/components/app/courses/professor-drawer"

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark")
}

/** Old project exclusion: PE courses have no real exam sitting. */
const EXAM_EXPORT_EXCLUDED = ["تربیت بدنی", "ورزش 1"]

export function ExamSchedule() {
  const [open, setOpen] = useState(false)
  const { notedOfferings, isLoading, enabled } = useNotedOfferings()
  const user = useProfileStore((s) => s.user)
  const profile = useProfileStore((s) => s.profile)
  const noted = useProfileStore((s) => s.noted)
  const passed = useProfileStore((s) => s.passed)
  const terms = useProfileStore((s) => s.terms)

  const [themeOpen, setThemeOpen] = useState(false)
  const [selected, setSelected] = useState<Offering | null>(null)
  const [professor, setProfessor] = useState<{
    name: string
    uni: string
    major: string
  } | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)

  // Group by exam date, chronological, «تاریخ نامشخص» last (old project order).
  const groups = useMemo(() => {
    const map = new Map<string, typeof notedOfferings>()
    for (const o of notedOfferings) {
      const date = extractDate(o.examSchedule) ?? "تاریخ نامشخص"
      map.set(date, [...(map.get(date) ?? []), o])
    }
    return [...map.entries()]
      .map(([date, items]) => ({ date, items }))
      .filter((g) => g.items.length > 0)
      .sort((a, b) => {
        if (a.date === "تاریخ نامشخص") return 1
        if (b.date === "تاریخ نامشخص") return -1
        return a.date.localeCompare(b.date)
      })
  }, [notedOfferings])

  const isNoted = (o: Offering) =>
    noted.some((n) => !n.isDeleted && n.courseIndex === o.index)

  const daysRemaining = (date: string): number | null => {
    if (date === "تاریخ نامشخص") return null
    try {
      return persianDateDiff(getCurrentDatePersian(), date)
    } catch {
      return null
    }
  }

  const runExport = async (isDark: boolean) => {
    // Export limit — image render can't handle huge lists
    if (notedOfferings.length > 30) {
      toastManager.add({
        type: "error",
        title: "خروجی عکس ممکن نیست",
        description: "حداکثر ۳۰ درس برای خروجی عکس مجاز است",
        data: { variant: "x" },
      })
      throw new Error("export-limit")
    }
    await captureScreenshot(isDark)
    setThemeOpen(false)
  }

  const captureScreenshot = async (isDark: boolean) => {
    try {
      const palette = exportPalette(isDark, "red")
      const canvasWidth = 800
      // Count ALL rendered items (same filter as the render loop) for accurate height
      const renderedItems = groups.flatMap((g) =>
        g.items.filter((o) => !EXAM_EXPORT_EXCLUDED.includes(o.courseName))
      )
      // 50px header top, 200px avatar, 20px gap, 40px name, 60px title, rows*140, groupHeaders*50, groups*30, bottom padding
      const estimatedHeight =
        50 +
        200 +
        20 +
        40 +
        60 +
        groups.reduce((h, g) => {
          const count = g.items.filter(
            (o) => !EXAM_EXPORT_EXCLUDED.includes(o.courseName)
          ).length
          return h + 50 + count * 140
        }, 0) +
        groups.length * 30 +
        50
      const canvasHeight = Math.max(600, estimatedHeight)

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      ctx.fillStyle = palette.bg
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      ctx.direction = "rtl"
      ctx.textAlign = "right"
      ctx.textBaseline = "top"

      let y = 50
      y = await drawExportHeader(
        ctx,
        canvasWidth,
        y,
        isDark,
        palette,
        user?.photoUrl,
        user?.firstName || "دانشجو",
        "برنامه امتحانی"
      )

      for (const group of groups) {
        const groupItems = group.items.filter(
          (o) => !EXAM_EXPORT_EXCLUDED.includes(o.courseName)
        )
        if (groupItems.length === 0) continue
        // Draw group date header
        ctx.font = `28px Vazirmatn, sans-serif`
        ctx.font = `28px Vazirmatn, sans-serif`
        ctx.fillStyle = palette.accent
        ctx.textAlign = "right"
        ctx.fillText(
          formatPersianDateLong(group.date) ?? group.date,
          canvasWidth - 70,
          y
        )
        if (group.date !== "تاریخ نامشخص") {
          ctx.font = `20px Vazirmatn, sans-serif`
          ctx.fillStyle = palette.muted
          ctx.textAlign = "left"
          ctx.fillText(group.date, 70, y + 5)
        }
        ctx.textAlign = "right"
        y += 50
        for (const o of groupItems) {
          const times = extractTimes(o.examSchedule)
          y = drawExportRow(ctx, canvasWidth, y, isDark, palette, {
            name: o.courseName,
            professor: professorName(o) ?? null,
            leftTop: undefined,
            leftBottom: times[0]
              ? times[1]
                ? `${times[0]} تا ${times[1]}`
                : times[0]
              : undefined,
          })
        }
        y += 30
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("خطا در ساخت تصویر"))),
          "image/png",
          1.0
        )
      })
      const fileName = `exam-schedule-${Date.now()}.png`

      try {
        // Direct browser → Supabase PUT (unlimited); only tiny JSON calls hit Vercel.
        await exportImage(blob, "exam", undefined, cancelRef)
        toastManager.add({
          type: "success",
          title: "عکس با موفقیت ارسال شد",
          description: "در تلگرام برای شما ارسال شد",
          data: { variant: "x" },
        })
      } catch (uploadError) {
        if (uploadError instanceof ExportUploadCanceled) {
          toastManager.add({
            type: "info",
            title: "بارگذاری فایل لغو شد",
            data: { variant: "x" },
          })
          return
        }
        // Fallback: direct download (same UX as the old project)
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        toastManager.add({
          type: "warning",
          title: "آپلود ناموفق، فایل به صورت محلی دانلود شد",
          data: { variant: "x" },
        })
        // Rethrow so StatusButton does NOT show success for a failed send.
        throw uploadError
      }
    } catch (error) {
      if (error instanceof ExportUploadCanceled) return
      toastManager.add({
        type: "error",
        title: "خطا در گرفتن عکس",
        data: { variant: "x" },
      })
      throw error
    }
  }

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger
          render={<ToolButton title="برنامه امتحانی" icon={CalendarExamIcon} />}
        />
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader>
            <DrawerTitle>برنامه امتحانی</DrawerTitle>
            <DrawerDescription>
              لیست امتحان‌های دروس انتخابی شما
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-5 p-4">
            {enabled && !isLoading && groups.length > 0 && (
              <Button className="w-full" onClick={() => setThemeOpen(true)}>
                خروجی عکس
              </Button>
            )}
            {!enabled || isLoading || groups.length === 0 ? (
              <OfferingsEmpty enabled={enabled} isLoading={isLoading} />
            ) : (
              groups.map(({ date, items }) => {
                const remaining = daysRemaining(date)
                return (
                  <div key={date} className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-warning">
                        {date === "تاریخ نامشخص" ? (
                          <span>تاریخ نامشخص</span>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground">
                              {date}
                            </span>
                            <span>{formatPersianDateLong(date) ?? date}</span>
                          </>
                        )}
                      </div>
                      {remaining !== null && date !== "تاریخ نامشخص" && (
                        <div className="text-xs">
                          {remaining > 0 ? (
                            <>
                              {formatDaysRemainInPersian(remaining)}{" "}
                              {persianWeekDayFromDays(remaining)}{" "}
                              <span className="text-muted-foreground">
                                ({remaining} روز)
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">گذشته</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2.5">
                      {items.map((o) => {
                        const times = extractTimes(o.examSchedule)
                        return (
                          <div
                            key={o.index}
                            className="relative flex cursor-pointer flex-col gap-2 rounded-lg border bg-card px-4 pt-6 pb-4 text-sm"
                            onClick={() => setSelected(o)}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1">
                                <p className="line-clamp-1 text-sm">
                                  {o.courseName}
                                </p>
                              </div>
                              <ChevronLeft className="size-4 min-w-fit text-muted-foreground" />
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <p className="text-muted-foreground">
                                {professorName(o) ?? "استادی ثبت نشده"}
                              </p>
                              {times.length > 0 && (
                                <div className="text-sm font-medium text-warning">
                                  {times[0]}
                                  {times[1] ? ` تا ${times[1]}` : ""}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      {/* Nested: dark / light choice */}
      <Drawer open={themeOpen} onOpenChange={setThemeOpen}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>خروجی عکس</DrawerTitle>
            <DrawerDescription>عکس با چه حالتی ساخته شود؟</DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-2 p-4">
            <StatusButton
              className="w-full"
              variant="outline"
              successLabel="ارسال شد"
              onClick={() => runExport(true)}
            >
              حالت تیره
            </StatusButton>
            <StatusButton
              className="w-full"
              successLabel="ارسال شد"
              onClick={() => runExport(false)}
            >
              حالت روشن
            </StatusButton>
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      {/* Nested course detail */}
      <CourseDetailDrawer
        offering={selected}
        isNoted={selected ? isNoted(selected) : false}
        isPassed={
          selected
            ? passed.some((p) => p.courseName === selected.courseName)
            : false
        }
        isNew={false}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onToggleNote={(index) => useProfileStore.getState().toggleNote(index)}
        onTogglePassed={(name) => useProfileStore.getState().togglePassed(name)}
        onOpenProfessor={(name) =>
          setProfessor({
            name,
            uni: profile?.universitySlug ?? "",
            major: profile?.majorSlug ?? "",
          })
        }
        onSelectCourse={(course) => setSelected(course)}
      />

      {/* Nested professor drawer */}
      <ProfessorDrawer
        open={!!professor}
        onOpenChange={(o) => !o && setProfessor(null)}
        professorName={professor?.name ?? ""}
        uni={professor?.uni ?? ""}
        major={professor?.major ?? ""}
        currentCourseIndex={selected?.index ?? null}
        onCourseSelected={(course) => {
          setProfessor(null)
          setSelected(course)
        }}
      />
    </>
  )
}
