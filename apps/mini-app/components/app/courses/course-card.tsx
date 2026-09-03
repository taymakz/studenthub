"use client"

import { ChevronLeft } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { type Offering, type FriendCard, professorName } from "@/lib/api"
import {
  CourseBadges,
  CourseCardHeader,
  CourseTable,
  CourseTags,
} from "./sections"
import { FriendFaces } from "@/components/app/friends/friend-faces"

/** Visual state flags for a course card, grouped so the prop API stays small. */
export interface CourseCardFlags {
  noted: boolean
  passed: boolean
  new: boolean
  actionLoading?: boolean
}

export function CourseCard({
  offering,
  viewMode,
  onSelect,
  flags,
  className,
  mates,
  onMatesClick,
}: {
  offering: Offering
  viewMode: "full" | "simple"
  onSelect: (offering: Offering) => void
  flags: CourseCardFlags
  className?: string
  /** Friends who noted this course — stacked faces, top-right. */
  mates?: { count: number; sample: FriendCard[] }
  onMatesClick?: (offering: Offering) => void
}) {
  const cls = cn(
    "relative w-full cursor-pointer rounded-md border bg-card px-4 pt-8 pb-4 text-start text-sm",
    // Emil Kowalski: only animate transform and opacity for GPU acceleration
    "transition-transform duration-100 ease-out",
    // Active state feedback - scale(0.97) for responsive feel
    "active:scale-[0.98]",
    viewMode === "full" ? "hover:shadow-md" : "hover:bg-accent/40",
    flags.actionLoading && "blur-[2px]",
    className
  )

  if (viewMode === "simple") {
    return (
      <button type="button" className={cls} onClick={() => onSelect(offering)}>
        {mates && mates.count > 0 && (
          <FriendFaces
            sample={mates.sample}
            count={mates.count}
            onClick={() => onMatesClick?.(offering)}
          />
        )}
        <CourseBadges isNoted={flags.noted} isPassed={flags.passed} />
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
      </button>
    )
  }

  return (
    <button type="button" className={cls} onClick={() => onSelect(offering)}>
      {mates && mates.count > 0 && (
        <FriendFaces
          sample={mates.sample}
          count={mates.count}
          onClick={() => onMatesClick?.(offering)}
        />
      )}
      <CourseBadges isNoted={flags.noted} isPassed={flags.passed} />
      <div className="mb-2">
        <CourseCardHeader offering={offering} isNew={flags.new} />
      </div>
      <div className="mb-2">
        <CourseTable offering={offering} hideCopy />
      </div>
      <CourseTags offering={offering} />
    </button>
  )
}
