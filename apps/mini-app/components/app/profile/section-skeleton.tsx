"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"

/**
 * Single loading blocks that match each widget's real height (progress = 98px,
 * failed = 84px, course-changes = content area) so the page doesn't jump when
 * data arrives.
 */
export function GraduateSkeleton() {
  return <Skeleton className="h-[98px] w-full rounded-xl" />
}

export function FailedSkeleton() {
  return <Skeleton className="h-[84px] w-full rounded-xl" />
}

export function CourseChangesSkeleton() {
  return <Skeleton className="h-44 w-full rounded-xl" />
}
