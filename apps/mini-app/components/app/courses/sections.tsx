"use client"

import { ChevronLeft } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { CopyButton } from "@workspace/ui/components/copy-button"
import { cn } from "@workspace/ui/lib/utils"

import { type Offering, professorName } from "@/lib/api"
import { joinLocations, joinSchedules } from "@/components/app/profile/schedule-util"
import { fmt, unitClass } from "./course-format"

export type ErrorCourseType =
  | "class_schedule"
  | "exam_schedule"
  | "moaref"
  | "co_requisites"
  | "pre_requisites"
  | "gender"

export function CourseBadges({
  isNoted,
  isPassed,
}: {
  isNoted: boolean
  isPassed: boolean
}) {
  return (
    <div className="absolute top-1 left-4 flex gap-1 text-sm">
      {isNoted && (
        <span className="rounded-full bg-primary/10 px-1 py-px text-primary">
          یادداشت شده
        </span>
      )}
      {isPassed && (
        <span className="rounded-full bg-success/10 px-1 py-px text-success">
          پاس شده
        </span>
      )}
    </div>
  )
}

export function CourseCardHeader({
  offering,
  isNew,
}: {
  offering: Offering
  isNew: boolean
}) {
  const name = professorName(offering)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <p className="line-clamp-1">{offering.courseName}</p>
          {isNew && (
            <span className="mr-1 rounded-full bg-success/10 px-1.5 py-px text-sm text-success">
              جدید
            </span>
          )}
        </div>
        <ChevronLeft className="size-4 min-w-fit text-muted-foreground" />
      </div>
      <div className="flex items-center justify-between">
        <p className={name ? "text-primary" : "text-muted-foreground"}>
          {name ?? "استادی ثبت نشده"}
        </p>
      </div>
    </div>
  )
}

function TableRow({
  label,
  value,
  ltr,
  error,
  copyText,
}: {
  label: string
  value: string
  ltr?: boolean
  error?: boolean
  copyText?: string
}) {
  return (
    <div className="flex justify-between gap-1 border-b border-border/60 py-2 text-sm">
      <div
        className={cn(
          "text-muted-foreground",
          error && "animate-pulse text-warning"
        )}
      >
        {label}
      </div>
      <div
        dir={ltr ? "ltr" : undefined}
        className={cn(
          "flex items-center gap-2 font-sans font-medium",
          error && "animate-pulse text-warning"
        )}
      >
        <span>{value}</span>
        {copyText && (
          <CopyButton
            text={copyText}
            label="کپی"
            variant="ghost"
            size="icon-xs"
            className="-my-1 !size-6 h-6 min-h-0 w-6 p-0 text-primary [&_svg]:!size-3.5"
          />
        )}
      </div>
    </div>
  )
}

export function CourseTable({
  offering,
  hideCopy,
  hideCourseCode,
  hideClassCode,
  errorType,
}: {
  offering: Offering
  hideCopy?: boolean
  hideCourseCode?: boolean
  hideClassCode?: boolean
  errorType?: ErrorCourseType
}) {
  return (
    <div className="space-y-0 text-sm text-card-foreground/80">
      {!hideCourseCode && (
        <TableRow
          label="کد درس"
          value={fmt(offering.courseCode)}
          ltr
          copyText={hideCopy ? undefined : offering.courseCode}
        />
      )}
      {!hideClassCode && (
        <TableRow label="کد ارائه" value={fmt(offering.classCode)} ltr />
      )}
      <TableRow label="مکان" value={joinLocations(offering.location) || "ثبت نشده"} ltr />
      <TableRow
        label="زمان تشکیل کلاس"
        value={joinSchedules(offering.classSchedule) || "ثبت نشده"}
        ltr
        error={errorType === "class_schedule"}
      />
      <TableRow
        label="زمان امتحان"
        value={offering.examSchedule || "ثبت نشده"}
        ltr
        error={errorType === "exam_schedule"}
      />
    </div>
  )
}

export function CourseTags({ offering }: { offering: Offering }) {
  return (
    <div className="flex flex-wrap gap-1 text-sm">
      {String(offering.theoreticalUnits) !== "0" && (
        <div
          className={cn(
            "rounded-full px-2 py-1",
            unitClass(offering.theoreticalUnits)
          )}
        >
          واحد نظری {offering.theoreticalUnits}
        </div>
      )}
      {String(offering.practicalUnits) !== "0" && (
        <div
          className={cn(
            "rounded-full px-2 py-1",
            unitClass(offering.practicalUnits)
          )}
        >
          واحد عملی {offering.practicalUnits}
        </div>
      )}
      <Badge variant="outline">{offering.degree}</Badge>
    </div>
  )
}
