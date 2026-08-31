"use client"

import { EyeOff, Users } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { Spinner } from "@workspace/ui/components/spinner"

import { fetchCourseStudents, fetchMe } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"
import type { Offering } from "@/lib/api"

interface StudentsDrawerProps {
  offering: Offering | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onParentClose?: () => void
}

export function StudentsDrawer({
  offering,
  open,
  onOpenChange,
  onParentClose,
}: StudentsDrawerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const storeUser = useProfileStore((s) => s.user)
  const storeProfile = useProfileStore((s) => s.profile)

  useEffect(() => {
    if (open) onOpenChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Fresh visibility from /me (source of truth) — fixes stale store after toggle
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: open,
  })
  const freshUser = meQuery.data?.data?.user
  const freshProfile = meQuery.data?.data?.profile
  const visible =
    freshUser?.visibleInCourseLists ?? storeUser?.visibleInCourseLists ?? true
  const isMeLoading = meQuery.isLoading
  const effectiveProfile = freshProfile ?? storeProfile
  const hasProfile = Boolean(
    effectiveProfile?.universitySlug && effectiveProfile?.majorSlug
  )

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["course-students"],
    queryFn: async ({ pageParam }) => {
      const res = await fetchCourseStudents({
        page: pageParam as number,
        limit: 25,
      })
      return res.data
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: open && visible && hasProfile,
  })

  const students = data?.pages.flatMap((p) => p.students) ?? []
  const isForbidden = (error as unknown as { status?: number })?.status === 403

  if (!offering) return null

  const goSettings = () => {
    onOpenChange(false)
    onParentClose?.()
    // let drawer close animation finish before navigating, otherwise portal stays open
    setTimeout(() => router.push("/settings"), 180)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader className="text-center">
          <DrawerTitle>دانشجویان این درس</DrawerTitle>
          <DrawerDescription>
            دانشجویان هم‌رشته و هم‌دانشگاهی شما که نمایش در لیست را فعال
            کرده‌اند
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-4 p-4">
          {/* Enrollment info */}
          <div className="flex items-center justify-center gap-2 text-sm">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {offering.currentEnrollment ?? "—"} ثبت‌نامی
              {offering.maxCapacity ? ` از ${offering.maxCapacity}` : ""} ظرفیت
            </span>
          </div>

          {isMeLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <Spinner />
              <p className="text-sm text-muted-foreground">
                در حال بارگذاری...
              </p>
            </div>
          ) : !visible ? (
            <div className="rounded-lg border border-warning/20 bg-warning/10 p-4 text-center">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-warning/20">
                <EyeOff className="size-5 text-warning" />
              </div>
              <p className="text-sm font-medium">
                نمایش در لیست دانشجویان غیرفعال است
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                برای مشاهده لیست دانشجویان ابتدا باید نمایش خود را در لیست فعال
                کنید.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={goSettings}
              >
                رفتن به تنظیمات
              </Button>
            </div>
          ) : !hasProfile ? (
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                ابتدا پروفایل دانشگاهی خود را کامل کنید.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={goSettings}
              >
                تکمیل پروفایل
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <Spinner />
              <p className="text-sm text-muted-foreground">
                در حال بارگذاری...
              </p>
            </div>
          ) : isError ? (
            <div className="rounded-lg bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive">
                {(error as Error)?.message ?? "خطا در دریافت لیست"}
              </p>
              {isForbidden && (
                <p className="mt-1 text-xs text-muted-foreground">
                  نمایش در لیست دانشجویان را فعال کنید.
                </p>
              )}
            </div>
          ) : students.length === 0 ? (
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                هیچ دانشجویی با این شرایط یافت نشد.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                فقط دانشجویان هم‌دانشگاهی و هم‌رشته‌ای که نمایش را فعال کرده‌اند
                نمایش داده می‌شوند.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {students.length} دانشجو
              </p>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {students.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3"
                  >
                    <Avatar size="sm">
                      {s.photoUrl ? (
                        <AvatarImage src={s.photoUrl} alt={s.firstName} />
                      ) : null}
                      <AvatarFallback>
                        {(s.firstName?.[0] ?? "?") + (s.lastName?.[0] ?? "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {s.firstName} {s.lastName ?? ""}
                      </p>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {s.username ? `@${s.username}` : `#${s.id}`}
                        {s.termNumber ? ` · ترم ${s.termNumber}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {hasNextPage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  loading={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                >
                  بارگذاری بیشتر
                </Button>
              )}
            </div>
          )}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
