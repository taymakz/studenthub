"use client"

import { ChevronLeft } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { type Offering, professorName } from "@/lib/api"
import {
  CourseBadges,
  CourseCardHeader,
  CourseTable,
  CourseTags,
} from "./sections"

export interface CourseCardProps {
  offering: Offering
  isNoted: boolean
  isPassed: boolean
  isNew: boolean
  viewMode: "full" | "simple"
  onSelect: (offering: Offering) => void
  isActionLoading?: boolean
  className?: string
}

export function CourseCard({
  offering,
  isNoted,
  isPassed,
  isNew,
  viewMode,
  onSelect,
  isActionLoading,
  className,
}: CourseCardProps) {
  const cls = cn(
    "relative cursor-pointer rounded-md border bg-card px-4 pt-8 pb-4 text-sm",
    // Emil Kowalski: only animate transform and opacity for GPU acceleration
    "transition-transform duration-100 ease-out",
    // Active state feedback - scale(0.97) for responsive feel
    "active:scale-[0.98]",
    viewMode === "full" ? "hover:shadow-md" : "hover:bg-accent/40",
    isActionLoading && "blur-[2px]",
    className
  )

  if (viewMode === "simple") {
    return (
      <div className={cls} onClick={() => onSelect(offering)}>
        <CourseBadges isNoted={isNoted} isPassed={isPassed} />
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <p className="line-clamp-1 font-medium">{offering.courseName}</p>
          </div>
          <ChevronLeft className="size-4 min-w-fit text-muted-foreground" />
        </div>
        <div className="flex items-center justify-between text-sm">
          {(() => {
            const name = professorName(offering)
            return (
              <p className={name ? "text-primary" : "text-muted-foreground"}>
                {name ?? "استادی ثبت نشده"}
              </p>
            )
          })()}
          <p className="text-sm">{offering.classCode}</p>
        </div>
        <div className="mt-2 flex justify-between text-sm text-muted-foreground">
          <span className="ml-1">زمان تشکیل کلاس</span>
          <span>{offering.classSchedule || "ثبت نشده"}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cls} onClick={() => onSelect(offering)}>
      <CourseBadges isNoted={isNoted} isPassed={isPassed} />
      <div className="mb-2">
        <CourseCardHeader offering={offering} isNew={isNew} />
      </div>
      <div className="mb-2">
        <CourseTable offering={offering} hideCopy />
      </div>
      <CourseTags offering={offering} />
    </div>
  )
}
