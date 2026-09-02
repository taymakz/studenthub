"use client"

import { useRef, useState } from "react"

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

import { type Offering, professorName } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"
import { ToolButton } from "./tool-card"
import { CalendarExamIcon } from "./tool-icons"
import { useNotedOfferings, OfferingsEmpty } from "./use-noted-offerings"
import { extractDate } from "./schedule-util"
import { CourseDetailDrawer } from "@/components/app/courses/course-detail-drawer"
import { ProfessorDrawer } from "@/components/app/courses/professor-drawer"
import { ExamGroups } from "./exam/exam-groups"
import { captureExamScreenshot } from "./exam/use-exam-export"
import { ThemeDrawer } from "./schedule/schedule-panels"
import { exportImage, ExportUploadCanceled } from "@/lib/export-image"
import { toastManager } from "@workspace/ui/components/toast"

/** Group by exam date, chronological, «تاریخ نامشخص» last (old project order). */
function groupByExamDate(notedOfferings: Offering[]) {
  const groupMap = new Map<string, Offering[]>()
  for (const o of notedOfferings) {
    const date = extractDate(o.examSchedule) ?? "تاریخ نامشخص"
    groupMap.set(date, [...(groupMap.get(date) ?? []), o])
  }
  return [...groupMap.entries()]
    .map(([date, items]) => ({ date, items }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => {
      if (a.date === "تاریخ نامشخص") return 1
      if (b.date === "تاریخ نامشخص") return -1
      return a.date.localeCompare(b.date)
    })
}

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

  const groups = groupByExamDate(notedOfferings)

  const isNoted = (o: Offering) => noted.some((n) => !n.isDeleted && n.courseIndex === o.index)

  const runExport = async (isDark: boolean) => {
    if (notedOfferings.length > 30) {
      toastManager.add({ type: "error", title: "خروجی عکس ممکن نیست", description: "حداکثر ۳۰ درس برای خروجی عکس مجاز است", data: { variant: "x" } })
      throw new Error("export-limit")
    }
    try {
      await captureExamScreenshot(groups, isDark, { photoUrl: user?.photoUrl, firstName: user?.firstName }, cancelRef)
      setThemeOpen(false)
    } catch (error) {
      if (error instanceof ExportUploadCanceled) return
      toastManager.add({ type: "error", title: "خطا در گرفتن عکس", data: { variant: "x" } })
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
            {!enabled || isLoading || groups.length === 0 ? <OfferingsEmpty enabled={enabled} isLoading={isLoading} /> : <ExamGroups groups={groups} onSelect={setSelected} />}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      <ThemeDrawer open={themeOpen} onOpenChange={setThemeOpen} onExport={runExport} />

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
