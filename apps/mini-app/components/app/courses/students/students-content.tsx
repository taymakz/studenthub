"use client"

import { EyeOff } from "lucide-react"
import { Virtuoso } from "react-virtuoso"

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

import type { CourseStudent } from "@/lib/api"

export function StudentsHidden({ onGo }: { onGo: () => void }) {
  return (
    <div className="rounded-lg border border-warning/20 bg-warning/10 p-4 text-center">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-warning/20">
        <EyeOff className="size-5 text-warning" />
      </div>
      <p className="text-sm font-medium">نمایش در لیست دانشجویان غیرفعال است</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">برای مشاهده لیست دانشجویان ابتدا باید نمایش خود را در لیست فعال کنید.</p>
      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onGo}>رفتن به تنظیمات</Button>
    </div>
  )
}

export function StudentsNoProfile({ onGo }: { onGo: () => void }) {
  return (
    <div className="rounded-lg bg-muted/50 p-4 text-center">
      <p className="text-sm text-muted-foreground">ابتدا پروفایل دانشگاهی خود را کامل کنید.</p>
      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onGo}>تکمیل پروفایل</Button>
    </div>
  )
}

export function StudentsEmpty() {
  return (
    <div className="rounded-lg bg-muted/50 p-4 text-center">
      <p className="text-sm text-muted-foreground">هیچ دانشجویی با این شرایط یافت نشد.</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">فقط دانشجویان هم‌دانشگاهی که این درس را در لیست خود ثبت کرده‌اند و نمایششان فعال است نمایش داده می‌شوند.</p>
    </div>
  )
}

export function StudentsError({ message, isForbidden }: { message: string; isForbidden: boolean }) {
  return (
    <div className="rounded-lg bg-destructive/10 p-4 text-center">
      <p className="text-sm text-destructive">{message}</p>
      {isForbidden && <p className="mt-1 text-xs text-muted-foreground">نمایش در لیست دانشجویان را فعال کنید.</p>}
    </div>
  )
}

export function StudentsLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <Spinner />
      <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
    </div>
  )
}

function StudentRow({ student }: { student: CourseStudent }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <Avatar size="sm">
        {student.photoUrl ? <AvatarImage src={student.photoUrl} alt={student.firstName} /> : null}
        <AvatarFallback>{(student.firstName?.[0] ?? "?") + (student.lastName?.[0] ?? "")}</AvatarFallback>
      </Avatar>
      <p className="min-w-0 flex-1 truncate text-sm font-medium">
        {student.firstName} {student.lastName ?? ""}
      </p>
    </div>
  )
}

/**
 * Virtualized classmate list — same Virtuoso setup as the courses page, but
 * scrolling is driven by the DrawerPanel's ScrollArea viewport (the
 * noted-list drawer's scroll behavior) via `customScrollParent`. Spacing
 * uses padding on the item wrapper, never margins — Virtuoso measures
 * content boxes. Pages only append, so default index keys are stable.
 */
export function StudentsList({
  students,
  scrollParent,
  isFetchingNextPage,
  onLoadMore,
}: {
  students: CourseStudent[]
  scrollParent: HTMLDivElement | null
  isFetchingNextPage: boolean
  onLoadMore: () => void
}) {
  return (
    <div>
      <p className="pb-2 text-xs text-muted-foreground">{students.length} دانشجو</p>
      {scrollParent ? (
        <Virtuoso
          customScrollParent={scrollParent}
          data={students}
          overscan={6}
          endReached={onLoadMore}
          itemContent={(_, s) => (
            <div className="pb-2">
              <StudentRow student={s} />
            </div>
          )}
        />
      ) : null}
      {isFetchingNextPage && (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      )}
    </div>
  )
}
