"use client"

import { useState } from "react"

import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
} from "@workspace/ui/components/drawer"

import type { Offering } from "@/lib/api"
import {
  CourseBadges,
  CourseCardHeader,
  CourseTable,
  type ErrorCourseType,
} from "./sections"
import { CourseActionDrawer } from "./course-action-drawer"
import type { CourseConflict } from "./conflict-detect"
import { ChevronLeft } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { useProfileStore } from "@/stores/profile-store"
import { IsLastTermDrawer } from "@/components/app/settings/is-last-term-drawer"

export function ConflictsDrawer({
  open,
  onOpenChange,
  conflicts,
  onToggleNote,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: CourseConflict[]
  onToggleNote: (courseIndex: string) => void
}) {
  const [selected, setSelected] = useState<Offering | null>(null)
  const [lastTermOpen, setLastTermOpen] = useState(false)
  const profile = useProfileStore((s) => s.profile)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerPopup variant="default" showBar>
          <DrawerHeader>
            <DrawerTitle>لیست تداخلات</DrawerTitle>
            <DrawerDescription>
              لیست تداخلات زمانی – معارف – عدم رعایت پیش‌نیاز و هم‌نیاز
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-6 p-4">
            {conflicts.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                تداخلی وجود ندارد
              </p>
            ) : (
              conflicts.map((group, index) => (
                <div
                  key={group.id}
                  className="space-y-6 rounded-lg border border-warning p-4"
                >
                  <p className="text-center text-sm font-medium text-warning">
                    {index + 1} - {group.reason}
                  </p>
                  {group.type === "moaref" &&
                    group.courses.length === 2 &&
                    !profile?.isLastTerm && (
                      <div className="space-y-2">
                        <p className="text-center text-xs text-muted-foreground">
                          آیا ترم آخر هستید؟
                        </p>
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => setLastTermOpen(true)}
                        >
                          انتخاب ترم آخر
                        </Button>
                      </div>
                    )}
                  {group.courses.map((o) => (
                    <ConflictCard
                      key={o.index}
                      offering={o}
                      errorType={group.type}
                      onSelected={setSelected}
                    />
                  ))}
                </div>
              ))
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      <CourseActionDrawer
        offering={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onDelete={(index) => {
          onToggleNote(index)
          setSelected(null)
        }}
        conflictGroups={conflicts}
        isLastTerm={profile?.isLastTerm ?? false}
      />

      <IsLastTermDrawer
        open={lastTermOpen}
        onOpenChange={setLastTermOpen}
        hideTrigger
      />
    </>
  )
}

function ConflictCard({
  offering,
  errorType,
  onSelected,
}: {
  offering: Offering
  errorType: ErrorCourseType
  onSelected: (o: Offering) => void
}) {
  return (
    <button
      type="button"
      className="relative w-full cursor-pointer rounded-md border bg-card px-4 pt-8 pb-4 text-start text-sm"
      onClick={() => onSelected(offering)}
    >
      <CourseBadges isNoted={false} isPassed={false} />
      <div className="mb-2">
        <CourseCardHeader offering={offering} isNew={false} />
      </div>
      <div className="mb-2">
        <CourseTable
          offering={offering}
          hideCopy
          hideCourseCode
          hideClassCode
          errorType={errorType}
        />
      </div>
      <div className="flex items-center justify-center gap-1 py-2 text-muted-foreground">
        <span className="text-xs">عملیات</span>
        <ChevronLeft className="size-3.5" />
      </div>
    </button>
  )
}
