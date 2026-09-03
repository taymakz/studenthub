"use client"

import { useEffect, useRef, useState } from "react"

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
import { toastManager } from "@workspace/ui/components/toast"

import { type Offering } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"
import { ToolButton } from "./tool-card"
import { CalendarWeekIcon } from "./tool-icons"
import { useNotedOfferings, OfferingsEmpty } from "./use-noted-offerings"
import { extractWeekday } from "./schedule-util"
import { groupByWeekday } from "./export-canvas"
import { CourseDetailDrawer } from "@/components/app/courses/course-detail-drawer"
import { ProfessorDrawer } from "@/components/app/courses/professor-drawer"
import { CourseMatesDrawer } from "@/components/app/friends/friend-course-mates-drawer"
import { useMyCourseMatesMap } from "@/components/app/friends/use-friends-data"
import { WeeklyGroups } from "./weekly/weekly-groups"
import { captureWeeklyScreenshot } from "./weekly/use-weekly-export"
import { useWeeklyDescription } from "./weekly/use-weekly-description"
import { ThemeDrawer } from "./schedule/schedule-panels"
import { ExportUploadCanceled } from "@/lib/export-image"

export const OPEN_WEEKLY_SCHEDULE_EVENT = "open-weekly-schedule"

export function WeeklySchedule({ hideTrigger = false }: { hideTrigger?: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(OPEN_WEEKLY_SCHEDULE_EVENT, handler)
    return () => window.removeEventListener(OPEN_WEEKLY_SCHEDULE_EVENT, handler)
  }, [])
  const { notedOfferings, isLoading, enabled } = useNotedOfferings()
  const user = useProfileStore((s) => s.user)
  const profile = useProfileStore((s) => s.profile)
  const noted = useProfileStore((s) => s.noted)
  const passed = useProfileStore((s) => s.passed)
  const terms = useProfileStore((s) => s.terms)

  const [themeOpen, setThemeOpen] = useState(false)
  const [selected, setSelected] = useState<Offering | null>(null)
  const [matesFor, setMatesFor] = useState<Offering | null>(null)
  const { matesByIndex, uni, major, termCode } = useMyCourseMatesMap(open)
  const [professor, setProfessor] = useState<{
    name: string
    uni: string
    major: string
  } | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)

  const groups = groupByWeekday(notedOfferings, (o) => extractWeekday(o.classSchedule))

  const isNoted = (o: Offering) => noted.some((n) => !n.isDeleted && n.courseIndex === o.index)
  const description = useWeeklyDescription(groups)

  const runExport = async (isDark: boolean) => {
    if (notedOfferings.length > 30) {
      toastManager.add({ type: "error", title: "خروجی عکس ممکن نیست", description: "حداکثر ۳۰ درس برای خروجی عکس مجاز است", data: { variant: "x" } })
      throw new Error("export-limit")
    }
    try {
      await captureWeeklyScreenshot(groups, isDark, { photoUrl: user?.photoUrl, firstName: user?.firstName }, cancelRef)
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
        {!hideTrigger && (
          <DrawerTrigger
            render={<ToolButton title="برنامه هفتگی" icon={CalendarWeekIcon} />}
          />
        )}
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
            {!enabled || isLoading || groups.length === 0 ? <OfferingsEmpty enabled={enabled} isLoading={isLoading} /> : <WeeklyGroups groups={groups} onSelect={setSelected} matesByIndex={matesByIndex} onMatesClick={setMatesFor} />}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      <CourseMatesDrawer
        offering={matesFor}
        uni={uni}
        major={major}
        termCode={termCode}
        open={!!matesFor}
        onOpenChange={(o) => !o && setMatesFor(null)}
      />

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
