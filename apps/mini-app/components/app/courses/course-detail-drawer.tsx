"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import {
  ArrowLeft,
  BookmarkAdd,
  BookmarkMinus,
  Eye3,
  SquareForward,
} from "reicon-react"
import { ChevronDown, ChevronLeft, Users } from "lucide-react"

import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerPanel,
} from "@workspace/ui/components/drawer"
import { Button } from "@workspace/ui/components/button"
import { CopyButton } from "@workspace/ui/components/copy-button"
import { toastManager } from "@workspace/ui/components/toast"

import {
  type Offering,
  type OfferingChangedField,
  professorName,
} from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"
import { Badge } from "@workspace/ui/components/badge"
import { CourseTable, CourseTags, courseLine } from "./sections"
import { StudentsDrawer } from "./students-drawer"

function Divider({ label }: { label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="h-px w-fit grow rounded-full bg-border" />
      <div className="text-center text-sm text-muted-foreground">{label}</div>
      <div className="h-px w-fit grow rounded-full bg-border" />
    </div>
  )
}

export function CourseDetailDrawer({
  offering,
  isNoted,
  isPassed,
  isNew,
  changes,
  open,
  onOpenChange,
  onToggleNote,
  onTogglePassed,
  onOpenProfessor,
  onSelectCourse,
}: {
  offering: Offering | null
  isNoted: boolean
  isPassed: boolean
  isNew: boolean
  changes?: OfferingChangedField[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleNote: (courseIndex: string) => void
  onTogglePassed?: (courseName: string) => void
  onOpenProfessor: (name: string) => void
  onSelectCourse?: (offering: Offering) => void
}) {
  const pathname = usePathname()
  const allOfferings = useProfileStore((s) => s.offerings)
  const termCode = useProfileStore((s) => s.termCode)
  const terms = useProfileStore((s) => s.terms)
  const [studentsOpen, setStudentsOpen] = useState(false)
  const o = offering

  const canEditNoted = useMemo(() => {
    if (!termCode || terms.length === 0) return false
    const sorted = [...terms].sort((a, b) =>
      b.termCode.localeCompare(a.termCode)
    )
    return new Set(sorted.slice(0, 2).map((t) => t.termCode)).has(termCode)
  }, [termCode, terms])

  // Close drawers on route change (e.g. رفتن به تنظیمات → back)
  useEffect(() => {
    if (open) onOpenChange(false)
    if (studentsOpen) setStudentsOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const otherProfessors = useMemo(
    () =>
      allOfferings.filter(
        (x) =>
          x.courseName === o?.courseName &&
          professorName(x) !== professorName(o as Offering)
      ),
    [allOfferings, o?.courseName, o?.professor]
  )

  const chart = useProfileStore((s) => s.chart)
  const passed = useProfileStore((s) => s.passed)
  const failed = useProfileStore((s) => s.failed)
  const passedNames = useMemo(
    () => new Set(passed.map((p) => p.courseName)),
    [passed]
  )
  const failedNames = useMemo(
    () => new Set(failed.map((f) => f.courseName)),
    [failed]
  )

  const chartCourse = useMemo(() => {
    if (!chart || !o) return null
    const all = [
      ...Object.values(chart.terms ?? {}).flat(),
      ...(chart.moaref ?? []),
      ...(chart.unknown ?? []),
      ...Object.values(chart.electives ?? {}).flatMap(
        (g: any) => g.courses ?? []
      ),
    ] as any[]
    return all.find((c) => c.name === o.courseName) ?? null
  }, [chart, o?.courseName])

  const prereqs = (chartCourse as any)?.prerequisites as
    string[] | number | undefined
  const coreqs = (chartCourse as any)?.corequisites as string[] | undefined
  const prereqList = Array.isArray(prereqs) ? prereqs : []
  const isPrereqUnits = typeof prereqs === "number"
  const passedUnits = useMemo(() => {
    if (!chart) return 0
    const all = [
      ...Object.values(chart.terms ?? {}).flat(),
      ...(chart.moaref ?? []),
      ...(chart.unknown ?? []),
    ] as any[]
    let sum = 0
    for (const name of passedNames) {
      const c = all.find((x) => x.name === name)
      if (c && typeof c.prerequisites === "number") continue
      const u = (c?.theoreticalUnits ?? 0) + (c?.practicalUnits ?? 0)
      sum += u || 3
    }
    return sum
  }, [chart, passedNames])

  // Always render, control via open prop for animation
  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>
              {/* Course name - center, small */}
              <div className="mb-4 flex items-center justify-center gap-0.5 text-center text-sm">
                <p className="truncate">{o?.courseName ?? ""}</p>
                {isNew && (
                  <span className="mr-1 rounded-full bg-success/10 px-1.5 py-px text-sm text-success">
                    جدید
                  </span>
                )}
              </div>

              {/* Professor name with eye icon - center */}
              <div className="mb-4 text-center text-sm">
                {o && professorName(o) ? (
                  <button
                    type="button"
                    className="mx-auto flex cursor-pointer items-center justify-center gap-2 rounded-md px-2 py-1 text-primary hover:bg-muted/50 active:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation()
                      const name = professorName(o)
                      if (name) onOpenProfessor(name)
                    }}
                  >
                    <span>{professorName(o)}</span>
                    <Eye3 size={24} />
                  </button>
                ) : (
                  <span className="text-muted-foreground">ثبت نشده</span>
                )}
              </div>
            </DrawerTitle>
          </DrawerHeader>
          <DrawerPanel className="space-y-4 p-4 text-sm">
            {/* جزئیات */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-px w-fit grow rounded-full bg-border" />
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span>جزئیات</span>
                  {o && (
                    <CopyButton
                      text={() => courseLine(o, "full")}
                      label="کپی جزئیات"
                      variant="ghost"
                      size="icon-xs"
                      className="-my-1 !size-6 h-6 min-h-0 w-6 p-0 [&_svg]:!size-3.5"
                    />
                  )}
                </div>
                <div className="h-px w-fit grow rounded-full bg-border" />
              </div>
              {o && <CourseTable offering={o} />}
            </div>

            {/* Tags */}
            {o && <CourseTags offering={o} />}

            {/* Prerequisites */}
            {chart?.isCompleted &&
              chartCourse &&
              (isPrereqUnits || prereqList.length > 0) && (
                <div className="space-y-2">
                  <Divider label="پیش‌نیاز" />
                  {isPrereqUnits ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant={
                          passedUnits >= (prereqs as number)
                            ? "success"
                            : "destructive"
                        }
                        className="px-2 py-1 text-xs"
                      >
                        حداقل {prereqs as number} واحد
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {prereqList.map((name) => {
                        const isPassed = passedNames.has(name as string)
                        const isFailed = failedNames.has(name as string)
                        return (
                          <Badge
                            key={name as string}
                            variant={
                              isPassed
                                ? "success"
                                : isFailed
                                  ? "warning"
                                  : "destructive"
                            }
                            className="px-2 py-1 text-xs"
                          >
                            {name as string}
                          </Badge>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

            {/* Corequisites */}
            {chart?.isCompleted &&
              chartCourse &&
              coreqs &&
              coreqs.length > 0 && (
                <div className="space-y-2">
                  <Divider label="همنیاز" />
                  <div className="flex flex-wrap gap-1.5">
                    {coreqs.map((name) => {
                      const isPassed = passedNames.has(name)
                      return (
                        <Badge
                          key={name}
                          variant={isPassed ? "success" : "warning"}
                          className="px-2 py-1 text-xs"
                        >
                          {name}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}

            {/* Changes */}
            {changes && changes.length > 0 && (
              <div className="space-y-2">
                <Divider label="تغییرات" />
                <div className="space-y-2 text-sm">
                  {changes.map((ch) => (
                    <div
                      key={ch.field}
                      className="rounded-md bg-info/5 px-3 py-2"
                    >
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        {ch.label}
                      </p>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs text-destructive/70 line-through">
                          {ch.before ?? "-"}
                        </span>
                        <ChevronDown className="size-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">
                          {ch.after ?? "-"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <div className="flex gap-2">
                {!isNoted ? (
                  <Button
                    className="flex-1 gap-1.5 text-sm"
                    disabled={!canEditNoted}
                    onClick={() => {
                      if (o) {
                        onToggleNote(o.index)
                        toastManager.add({
                          type: "success",
                          title: "اضافه شد.",
                          data: { variant: "x" },
                        })
                      }
                    }}
                  >
                    <BookmarkAdd size={24} />
                    {canEditNoted
                      ? "اضافه کردن به یادداشت‌ها"
                      : "نیم سال انتخابی قدیمی است"}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    className="flex-1 gap-1.5 text-sm"
                    disabled={!canEditNoted}
                    onClick={() => {
                      if (o) {
                        onToggleNote(o.index)
                        toastManager.add({
                          type: "success",
                          title: "حذف شد.",
                          data: { variant: "x" },
                        })
                      }
                    }}
                  >
                    <BookmarkMinus size={24} />
                    {canEditNoted
                      ? "حذف از یادداشت‌ها"
                      : "نیم سال انتخابی قدیمی است"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="اشتراک گذاری"
                  onClick={() => {
                    if (!o) return
                    const text = courseLine(o, "full")
                    const miniAppUrl =
                      typeof window !== "undefined"
                        ? window.location.origin
                        : ""
                    const url = encodeURIComponent(
                      `${miniAppUrl}/?startapp=cd${o.courseCode}&mode=fullscreen`
                    )
                    const shareLink = `https://t.me/share/url?url=${url}&text=${encodeURIComponent(text)}`
                    window.open(shareLink, "_blank")
                  }}
                >
                  <SquareForward size={24} />
                </Button>
              </div>

              <Button
                variant="outline"
                className="w-full gap-2 text-sm"
                onClick={() => setStudentsOpen(true)}
              >
                <Users className="size-4" />
                مشاهده دانشجویان این درس
              </Button>
            </div>

            {/* با اساتید و تایم های دیگه - single column grid */}
            {otherProfessors.length > 0 && (
              <div className="mt-6">
                <div className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
                  این درس با سایر اساتید
                  <ChevronLeft className="size-5" />
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {otherProfessors.map((x) => (
                    <div
                      key={x.index}
                      className="cursor-pointer rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                      onClick={() => {
                        if (onSelectCourse) onSelectCourse(x)
                        else onOpenProfessor(professorName(x) ?? "")
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {professorName(x) ?? "بدون نام"}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{x.classCode}</span>
                            {x.classSchedule && (
                              <>
                                <span>•</span>
                                <span>{x.classSchedule}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      {/* Students nested drawer */}
      <StudentsDrawer
        offering={o}
        open={studentsOpen}
        onOpenChange={setStudentsOpen}
        onParentClose={() => onOpenChange(false)}
      />
    </>
  )
}
