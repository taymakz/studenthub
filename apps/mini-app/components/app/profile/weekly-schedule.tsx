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
import { CalendarWeekIcon } from "./tool-icons"
import { useNotedOfferings, OfferingsEmpty } from "./use-noted-offerings"
import { extractTimes, extractWeekday } from "./schedule-util"
import {
  drawExportHeader,
  drawExportRow,
  exportPalette,
  groupByWeekday,
  soonestClassMessage,
} from "./export-canvas"
import { exportImage, ExportUploadCanceled } from "@/lib/export-image"
import { CourseDetailDrawer } from "@/components/app/courses/course-detail-drawer"
import { ProfessorDrawer } from "@/components/app/courses/professor-drawer"

const DAY_ORDER = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
]

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark")
}

export function WeeklySchedule() {
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

  const groups = useMemo(
    () =>
      groupByWeekday(notedOfferings, (o) => extractWeekday(o.classSchedule)),
    [notedOfferings]
  )

  const isNoted = (o: Offering) =>
    noted.some((n) => !n.isDeleted && n.courseIndex === o.index)

  // «کلاس بعدی …» — recomputed every minute like the old project.
  const [description, setDescription] = useState("برنامه خالی میباشد")
  useEffect(() => {
    const startOf = (o: Offering) => {
      const t = extractTimes(o.classSchedule)[0]
      if (!t) return null
      const [hStr, mStr] = t.split(":")
      const h = Number(hStr)
      const m = Number(mStr)
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null
      return h * 60 + m
    }
    const endOf = (o: Offering) => {
      const t = extractTimes(o.classSchedule)[1]
      if (!t) return null
      const [hStr, mStr] = t.split(":")
      const h = Number(hStr)
      const m = Number(mStr)
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null
      return h * 60 + m
    }
    const strOf = (o: Offering) => extractTimes(o.classSchedule)[0] ?? null
    const update = () =>
      setDescription(soonestClassMessage(groups, startOf, endOf, strOf))
    update()
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [groups])

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
      const palette = exportPalette(isDark, "green")
      const canvasWidth = 800
      const estimatedHeight =
        50 +
        200 +
        20 +
        40 +
        60 +
        groups.reduce((h, g) => h + 50 + g.items.length * 140 + 30, 0) +
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
        "برنامه هفتگی"
      )

      for (const group of groups) {
        if (group.items.length === 0) continue
        ctx.font = `28px Vazirmatn, sans-serif`
        ctx.fillStyle = palette.accent
        ctx.textAlign = "right"
        ctx.fillText(group.day, canvasWidth - 70, y)
        y += 50
        for (const o of group.items) {
          const times = extractTimes(o.classSchedule)
          y = drawExportRow(ctx, canvasWidth, y, isDark, palette, {
            name: o.courseName,
            professor: professorName(o) ?? null,
            leftTop:
              times.length > 0
                ? `${times[0]} تا ${times[1] ?? ""}`.trim()
                : undefined,
            leftBottom: o.location ?? undefined,
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
      const fileName = `weekly-schedule-${Date.now()}.png`

      try {
        // Direct browser → Supabase PUT (unlimited); only tiny JSON calls hit Vercel.
        await exportImage(blob, "weekly", undefined, cancelRef)
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
          render={<ToolButton title="برنامه هفتگی" icon={CalendarWeekIcon} />}
        />
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader>
            <DrawerTitle>برنامه هفتگی کلاس‌ها</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
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
              DAY_ORDER.filter((day) => groups.some((g) => g.day === day)).map(
                (day) => {
                  const items = groups.find((g) => g.day === day)!.items
                  return (
                    <div key={day} className="space-y-2">
                      <h3 className="font-semibold text-success">{day}</h3>
                      <div className="space-y-2.5">
                        {items.map((o) => {
                          const times = extractTimes(o.classSchedule)
                          return (
                            <div
                              key={o.index}
                              className="relative cursor-pointer space-y-2 rounded-lg border bg-card px-4 pt-6 pb-4 text-sm"
                              onClick={() => setSelected(o)}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  <p className="line-clamp-1">{o.courseName}</p>
                                </div>
                                <ChevronLeft className="size-4 min-w-fit text-muted-foreground" />
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <p className="text-muted-foreground">
                                  {professorName(o) ?? "استادی ثبت نشده"}
                                </p>
                                {times.length > 0 && (
                                  <div className="font-medium text-info">
                                    از {times[0]} تا {times[1]}
                                  </div>
                                )}
                              </div>
                              {o.location && (
                                <p className="text-xs text-muted-foreground">
                                  {o.location}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
              )
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
