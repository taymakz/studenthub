"use client"

import { ChevronLeft, Pencil, Star, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

import { ProfessorInformation } from "./professor-information"
import type { Offering } from "@/lib/api"

export function ProfessorLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12">
      <Spinner />
      <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
    </div>
  )
}

export function ProfessorIncompleteWarning() {
  return (
    <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-center text-xs text-muted-foreground">
      پروفایل دانشگاهی ناقص است — برای رأی دادن پروفایل را کامل کنید.
    </div>
  )
}

export function ProfessorActions({
  hasVoted,
  disabled,
  onVote,
  onEdit,
  onDelete,
}: {
  hasVoted: boolean
  disabled: boolean
  onVote: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  if (!hasVoted) {
    return (
      <Button className="w-full gap-2" onClick={onVote} disabled={disabled}>
        <Star className="size-5" />
        رأی دادن به استاد
      </Button>
    )
  }
  return (
    <>
      <Button variant="outline" className="w-full gap-2" onClick={onEdit} disabled={disabled}>
        <Pencil className="size-5" />
        ویرایش رأی
      </Button>
      <Button variant="destructive" className="w-full gap-2" onClick={onDelete} disabled={disabled}>
        <Trash2 className="size-5" />
        حذف رأی
      </Button>
    </>
  )
}

export function ProfessorOtherCourses({
  courses,
  onSelect,
  onOpenChange,
}: {
  courses: Offering[]
  onSelect?: (offering: Offering) => void
  onOpenChange: (open: boolean) => void
}) {
  if (courses.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-px w-fit grow rounded-full bg-border" />
        <div className="text-center text-sm text-muted-foreground">دروس دیگر این استاد</div>
        <div className="h-px w-fit grow rounded-full bg-border" />
      </div>
      <div className="grid grid-cols-1 gap-2">
        {courses.map((course) => (
          <button
            type="button"
            key={course.index}
            className="w-full cursor-pointer rounded-lg bg-muted/30 p-3 text-start transition-colors hover:bg-muted/50"
            onClick={() => {
              onOpenChange(false)
              onSelect?.(course)
            }}
          >
            <div className="flex justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{course.courseName}</p>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  {course.classSchedule && <span>{course.classSchedule}</span>}
                </div>
              </div>
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function ProfessorMainContent({
  uni,
  major,
  professorName,
  total,
  averages,
  hasVoted,
  otherCourses,
  onVote,
  onEdit,
  onDelete,
  onOpenChange,
  onCourseSelected,
}: {
  uni: string
  major: string
  professorName: string
  total: number
  averages: Parameters<typeof ProfessorInformation>[0]["averages"]
  hasVoted: boolean
  otherCourses: Offering[]
  onVote: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenChange: (open: boolean) => void
  onCourseSelected?: (offering: Offering) => void
}) {
  const incomplete = !uni || !major
  return (
    <>
      {incomplete && <ProfessorIncompleteWarning />}
      <ProfessorInformation
        professorName={professorName}
        total={total}
        averages={averages}
        hideName
        hasVoted={hasVoted}
      />
      <div className="space-y-2">
        <ProfessorActions
          hasVoted={hasVoted}
          disabled={incomplete}
          onVote={onVote}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
      <ProfessorOtherCourses
        courses={otherCourses}
        onSelect={onCourseSelected}
        onOpenChange={onOpenChange}
      />
    </>
  )
}
