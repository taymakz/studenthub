"use client"

import { GitFork, Send } from "lucide-react"
import { BookOpen } from "reicon-react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { GITHUB_REPO_URL } from "@/constants"

function EmptyState({
  title,
  text,
  actions,
}: {
  title: string
  text: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <BookOpen className="size-9" weight="Filled" />
      <p className="text-lg font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
    </div>
  )
}

function openLink(url: string) {
  try {
    window.open(url, "_blank", "noopener")
  } catch {
    /* noop */
  }
}

export function CoursesEmptyStates({
  isLoading,
  complete,
  termCode,
  offeringsLength,
  filteredLength,
  filterCount,
  search,
  totalMatching,
  lastUpdated,
  onClearFilters,
}: {
  isLoading: boolean
  complete: boolean
  termCode: string | null | undefined
  offeringsLength: number
  filteredLength: number
  filterCount: number
  search: string
  totalMatching?: number
  lastUpdated?: string
  onClearFilters: () => void
}) {
  if (isLoading) {
    return (
      <>
        {totalMatching !== undefined && lastUpdated !== undefined && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <p>دروس ارائه شده تا الان: {totalMatching}</p>
            <p>آخرین بروزرسانی {lastUpdated}</p>
          </div>
        )}
        <div className="space-y-2 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-md" />
          ))}
        </div>
      </>
    )
  }

  if (!complete || !termCode) {
    return <EmptyState title="پروفایل ناقص" text="برای دیدن دروس، ابتدا پروفایل دانشگاهی خود را تکمیل کنید." />
  }

  if (offeringsLength === 0) {
    return (
      <EmptyState
        title="هیچ درسی موجود نیست"
        text="برای این ورودی درسی ثبت نشده است. در تکمیل رجیستری مشارکت کنید یا به ما اطلاع دهید."
        actions={
          <>
            <Button variant="outline" onClick={() => openLink(GITHUB_REPO_URL)}>
              <GitFork className="size-4" />
              مشارکت در گیت‌هاب
            </Button>
            <Button onClick={() => openLink("https://t.me/studenthubir?direct")}>
              <Send className="size-4" />
              ارتباط با پشتیبانی
            </Button>
          </>
        }
      />
    )
  }

  if (filteredLength === 0) {
    return (
      <EmptyState
        title="نتیجه‌ای یافت نشد"
        text="جستجو یا فیلترها را تغییر دهید."
        actions={
          filterCount > 0 || search.trim().length > 0 ? (
            <Button variant="outline" onClick={onClearFilters}>
              پاک کردن فیلترها
            </Button>
          ) : undefined
        }
      />
    )
  }

  return null
}

export function CoursesSkeletonHeader({
  totalMatching,
  lastUpdated,
}: {
  totalMatching: number
  lastUpdated: string
}) {
  return (
    <div className="flex justify-between text-sm text-muted-foreground">
      <p>دروس ارائه شده تا الان: {totalMatching}</p>
      <p>آخرین بروزرسانی {lastUpdated}</p>
    </div>
  )
}
