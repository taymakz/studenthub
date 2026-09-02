"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Users } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

import type { CourseStudent, Offering } from "@/lib/api"
import { useStudentsList, useStudentsVisibility } from "./students/use-students-data"
import {
  StudentsEmpty,
  StudentsError,
  StudentsHidden,
  StudentsList,
  StudentsLoading,
  StudentsNoProfile,
} from "./students/students-content"

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
  useEffect(() => {
    if (open) onOpenChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // The DrawerPanel's ScrollArea viewport drives the virtualized list.
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null)
  const { visible, hasProfile, isMeLoading } = useStudentsVisibility(open)
  const courseIndex = offering?.index ?? null
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useStudentsList(open, visible, hasProfile, courseIndex)

  const students = data?.pages.flatMap((p) => p.students) ?? []
  const isForbidden = (error as unknown as { status?: number })?.status === 403

  if (!offering) return null

  const goSettings = () => {
    onOpenChange(false)
    onParentClose?.()
    setTimeout(() => router.push("/settings"), 180)
  }

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader className="text-center">
          <DrawerTitle>دانشجویان این درس</DrawerTitle>
          <DrawerDescription>
            دانشجویان هم‌دانشگاهی که این درس را در لیست خود ثبت کرده‌اند و نمایششان فعال است
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-4 p-4" viewportRef={setScrollParent}>
          <div className="flex items-center justify-center gap-2 text-sm">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {offering.currentEnrollment ?? "—"} ثبت‌نامی
              {offering.maxCapacity ? ` از ${offering.maxCapacity}` : ""} ظرفیت
            </span>
          </div>
          <StudentsPanel
            state={{
              isMeLoading,
              visible,
              hasProfile,
              isLoading,
              isError,
              isForbidden,
            }}
            error={error}
            students={students}
            scrollParent={scrollParent}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={handleLoadMore}
            onGo={goSettings}
          />
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

function StudentsPanel(props: {
  state: {
    isMeLoading: boolean
    visible: boolean
    hasProfile: boolean
    isLoading: boolean
    isError: boolean
    isForbidden: boolean
  }
  error: unknown
  students: CourseStudent[]
  scrollParent: HTMLDivElement | null
  isFetchingNextPage: boolean
  onLoadMore: () => void
  onGo: () => void
}) {
  const s = props.state
  if (s.isMeLoading) return <StudentsLoading />
  if (!s.visible) return <StudentsHidden onGo={props.onGo} />
  if (!s.hasProfile) return <StudentsNoProfile onGo={props.onGo} />
  if (s.isLoading) return <StudentsLoading />
  if (s.isError) return <StudentsError message={(props.error as Error)?.message ?? "خطا در دریافت لیست"} isForbidden={s.isForbidden} />
  if (props.students.length === 0) return <StudentsEmpty />
  return (
    <StudentsList
      students={props.students}
      scrollParent={props.scrollParent}
      isFetchingNextPage={props.isFetchingNextPage}
      onLoadMore={props.onLoadMore}
    />
  )
}
