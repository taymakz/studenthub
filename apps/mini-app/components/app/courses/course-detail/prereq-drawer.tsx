"use client"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

import { CourseCard } from "@/components/app/courses/course-card"
import { groupByWeekday } from "@/components/app/profile/export-canvas"
import { useProfileStore } from "@/stores/profile-store"
import type { Offering } from "@/lib/api"

const DAY_ORDER = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه شنبه",
  "چهارشنبه",
  "پنج شنبه",
  "جمعه",
]

/**
 * Offerings of one prerequisite/corequisite course in MY current term,
 * grouped شنبه→جمعه (days without offerings are skipped). Same simple cards
 * as the noted list; tapping one swaps the parent detail to it.
 */
export function RequisiteOfferingsDrawer({
  courseName,
  open,
  onOpenChange,
  onSelectCourse,
}: {
  courseName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectCourse: (offering: Offering) => void
}) {
  const offerings = useProfileStore((s) => s.offerings)
  const noted = useProfileStore((s) => s.noted)
  const passed = useProfileStore((s) => s.passed)

  // Only actually available sections: unknown capacity counts as available,
  // a section is hidden only when it is provably full.
  const isAvailable = (o: Offering) =>
    o.maxCapacity == null ||
    o.currentEnrollment == null ||
    o.currentEnrollment < o.maxCapacity

  const named = courseName
    ? offerings.filter((o) => o.courseName === courseName)
    : []
  const items = named.filter(isAvailable)
  const groups = groupByWeekday(items)
  const ordered = DAY_ORDER.filter((day) =>
    groups.some((g) => g.day === day)
  ).map((day) => ({
    day,
    items: groups.find((g) => g.day === day)?.items ?? [],
  }))

  const isNoted = (o: Offering) =>
    noted.some((n) => !n.isDeleted && n.courseIndex === o.index)
  const isPassed = (o: Offering) =>
    passed.some((p) => p.courseName === o.courseName)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>{courseName ?? ""}</DrawerTitle>
          <DrawerDescription>
            کلاس‌های ارائه‌شده این نیم‌سال به تفکیک روز
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-4 p-4">
          {ordered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {named.length === 0
                ? "این درس در این نیم‌سال ارائه نشده است"
                : "ظرفیت کلاس‌های این درس تکمیل است"}
            </div>
          ) : (
            ordered.map(({ day, items }) => (
              <div key={day} className="space-y-2">
                <h3 className="font-semibold text-success">{day}</h3>
                <div className="space-y-2.5">
                  {items.map((entry) => {
                    const o = entry.offering
                    return (
                      <CourseCard
                        key={`${o.index}-${entry.sessionIndex}`}
                        offering={o}
                        viewMode="simple"
                        onSelect={(c) => {
                          onOpenChange(false)
                          onSelectCourse(c)
                        }}
                        flags={{
                          noted: isNoted(o),
                          passed: isPassed(o),
                          new: false,
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
