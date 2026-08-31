"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, EyeOff, CircleCheck } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"

import { SettingsRow } from "@/components/app/theme/settings-row"
import { fetchMe, toggleVisibility } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"
import { Badge } from "@workspace/ui/components/badge"

function getRemainingHours(lastUpdated: string | null): number {
  if (!lastUpdated) return 0
  const diff = Date.now() - new Date(lastUpdated).getTime()
  const hours = diff / (1000 * 60 * 60)
  if (hours >= 24) return 0
  return Math.ceil(24 - hours)
}

export default function CourseVisibility() {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe })
  const user = meQuery.data?.data?.user ?? null
  const visible = user?.visibleInCourseLists ?? true
  const lastUpdated = user?.visibleInCourseListsLastUpdated ?? null
  const remainingHours = getRemainingHours(lastUpdated)
  const canChange = remainingHours === 0

  const toggleMut = useMutation({
    mutationFn: async () => (await toggleVisibility()).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] })
      qc.invalidateQueries({ queryKey: ["course-students"] })
      // keep profile-store in sync (drawer also reads store as fallback)
      useProfileStore
        .getState()
        .refresh()
        .catch(() => {})
      setOpen(false)
    },
  })

  const description = !canChange
    ? `غیر قابل تغییر تا ${remainingHours} ساعت دیگر`
    : visible
      ? "فعال"
      : "غیر فعال"

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<Eye className="size-5" />}
            title="نمایش در لیست دانشجویان"
            description={description}
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>نمایش در لیست دانشجویان</DrawerTitle>
          <DrawerDescription>
            تنظیم نمایش شما در لیست دانشجویان دروس
            <br />
            <Badge variant="warning"> هر ۲۴ ساعت یکبار قابل تغییر است</Badge>
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-0">
          <div className="mb-4 flex flex-col">
            <button
              type="button"
              disabled={!canChange || toggleMut.isPending}
              onClick={() => canChange && !visible && toggleMut.mutate()}
              className="flex items-center px-4 py-5 hover:bg-muted/50 disabled:opacity-50"
            >
              <span className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="size-5 opacity-80" />
                  <p className="text-sm">فعال</p>
                </span>
                {visible ? (
                  <CircleCheck className="size-5 text-success" />
                ) : (
                  <span className="text-sm opacity-80">انتخاب</span>
                )}
              </span>
            </button>
            <button
              type="button"
              disabled={!canChange || toggleMut.isPending}
              onClick={() => canChange && visible && toggleMut.mutate()}
              className="flex items-center px-4 py-5 hover:bg-muted/50 disabled:opacity-50"
            >
              <span className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2">
                  <EyeOff className="size-5 opacity-80" />
                  <p className="text-sm">غیر فعال</p>
                </span>
                {!visible ? (
                  <CircleCheck className="size-5 text-success" />
                ) : (
                  <span className="text-sm opacity-80">انتخاب</span>
                )}
              </span>
            </button>
          </div>
          <div className="mx-4 mb-4 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
            {!canChange ? (
              <p className="font-medium text-warning">
                شما باید {remainingHours} ساعت دیگر صبر کنید تا بتوانید این
                تنظیم را تغییر دهید.
              </p>
            ) : null}
            <p>
              در صورت فعال‌سازی، در جزئیات دروس می‌توانید لیست دانشجویانی که آن
              درس را برداشته‌اند مشاهده کنید.
            </p>
            {toggleMut.isError && (
              <p className="mt-2 text-destructive">
                {(toggleMut.error as Error).message}
              </p>
            )}
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
