"use client"

import { EyeOff, Users } from "lucide-react"

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
      <p className="mt-1 text-xs text-muted-foreground">فقط دانشجویان هم‌دانشگاهی و هم‌رشته‌ای که نمایش را فعال کرده‌اند نمایش داده می‌شوند.</p>
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

export function StudentsList({
  students,
  hasNextPage,
  isFetchingNextPage,
  onNext,
}: {
  students: CourseStudent[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onNext: () => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{students.length} دانشجو</p>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {students.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Avatar size="sm">
              {s.photoUrl ? <AvatarImage src={s.photoUrl} alt={s.firstName} /> : null}
              <AvatarFallback>{(s.firstName?.[0] ?? "?") + (s.lastName?.[0] ?? "")}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.firstName} {s.lastName ?? ""}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {s.username ? `@${s.username}` : `#${s.id}`}
                {s.termNumber ? ` · ترم ${s.termNumber}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
      {hasNextPage && (
        <Button variant="outline" size="sm" className="w-full" loading={isFetchingNextPage} onClick={onNext}>بارگذاری بیشتر</Button>
      )}
    </div>
  )
}
