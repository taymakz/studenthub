"use client"

import { useState } from "react"
import { Eye3 } from "reicon-react"
import { ChevronLeft } from "lucide-react"

import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerPanel,
} from "@workspace/ui/components/drawer"
import { CopyButton } from "@workspace/ui/components/copy-button"

import {
  type Offering,
  type OfferingChangedField,
  professorName,
} from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"
import { CourseTable, CourseTags } from "./sections"
import { courseLine } from "./course-format"
import { StudentsDrawer } from "./students-drawer"
import { useStudentsList, useStudentsVisibility } from "./students/use-students-data"
import { FriendFaces } from "@/components/app/friends/friend-faces"
import { useCourseDetailClose, useCourseDetailDerived } from "./course-detail/use-course-detail"
import { ChangesSection, CoreqSection, PrereqSection } from "./course-detail/detail-sections"
import { DetailActions } from "./course-detail/detail-actions"

// Module-scope alias: hooks must be called, not referenced inside callbacks.
const getProfileState = useProfileStore.getState

/** Friend-classmates faces group (top of the panel, opens the friends list). */
function CourseFriendsGroup({
  courseIndex,
  enabled,
  onOpen,
}: {
  courseIndex: string | null
  enabled: boolean
  onOpen: () => void
}) {
  const { visible, hasProfile } = useStudentsVisibility(enabled)
  const matesQuery = useStudentsList(enabled, visible, hasProfile, courseIndex)
  const summary = matesQuery.data?.pages[0]?.friends
  const count = summary?.count ?? 0
  if (matesQuery.isLoading || count === 0 || !summary) return null
  return (
    <div className="flex items-center justify-center">
      <FriendFaces
        sample={summary.sample}
        count={count}
        onClick={onOpen}
        className="static"
        size="lg"
      />
    </div>
  )
}

/** Sum of units for every passed course that has prerequisites left to take. */
function sumPassedUnits(
  chart: ReturnType<typeof getProfileState>["chart"],
  passedNames: Set<string>
): number {
  if (!chart) return 0
  const all = [...Object.values(chart.terms ?? {}).flat(), ...(chart.moaref ?? []), ...(chart.unknown ?? [])] as Array<{ name: string; theoreticalUnits?: number; practicalUnits?: number; prerequisites?: unknown }>
  const coursesByName = new Map(all.map((x) => [x.name, x]))
  let sum = 0
  for (const name of passedNames) {
    const course = coursesByName.get(name)
    if (course && typeof course.prerequisites === "number") continue
    const u = (course?.theoreticalUnits ?? 0) + (course?.practicalUnits ?? 0)
    sum += u || 3
  }
  return sum
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
  const [studentsOpen, setStudentsOpen] = useState(false)
  const [friendsOpen, setFriendsOpen] = useState(false)
  const o = offering
  useCourseDetailClose(open, onOpenChange, studentsOpen, setStudentsOpen)
  const { canEditNoted, otherProfessors, passedNames, failedNames, chartCourse, chart } = useCourseDetailDerived(offering)

  const passedUnits = sumPassedUnits(getProfileState().chart, passedNames)

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
              <div className="text-center text-sm">
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
            {/* Friend classmates — same faces, between header and جزئیات */}
            <CourseFriendsGroup
              courseIndex={o?.index ?? null}
              enabled={open && !!o}
              onOpen={() => setFriendsOpen(true)}
            />
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

            <PrereqSection chart={chart} chartCourse={chartCourse} passedNames={passedNames} failedNames={failedNames} passedUnits={passedUnits} onSelectCourse={onSelectCourse} />
            <CoreqSection chart={chart} chartCourse={chartCourse} passedNames={passedNames} onSelectCourse={onSelectCourse} />
            <ChangesSection changes={changes} />
            <DetailActions offering={o} isNoted={isNoted} canEditNoted={canEditNoted} onToggleNote={onToggleNote} onStudents={() => setStudentsOpen(true)} />

            {/* با اساتید و تایم های دیگه - single column grid */}
            {otherProfessors.length > 0 && (
              <div className="mt-6">
                <div className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
                  این درس با سایر اساتید
                  <ChevronLeft className="size-5" />
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {otherProfessors.map((x) => (
                    <button
                      type="button"
                      key={x.index}
                      className="w-full cursor-pointer rounded-lg bg-muted/30 p-3 text-start transition-colors hover:bg-muted/50"
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
                    </button>
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

      {/* Friend classmates nested drawer */}
      <StudentsDrawer
        offering={o}
        open={friendsOpen}
        onOpenChange={setFriendsOpen}
        friendsOnly
      />
    </>
  )
}
