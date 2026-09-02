"use client"

import { Users } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

import type { Offering } from "@/lib/api"
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

  const { visible, hasProfile, isMeLoading } = useStudentsVisibility(open)
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useStudentsList(open, visible, hasProfile)

  const students = data?.pages.flatMap((p) => p.students) ?? []
  const isForbidden = (error as unknown as { status?: number })?.status === 403

  if (!offering) return null

  const goSettings = () => {
    onOpenChange(false)
    onParentClose?.()
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
          <div className="flex items-center justify-center gap-2 text-sm">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {offering.currentEnrollment ?? "—"} ثبت‌نامی
              {offering.maxCapacity ? ` از ${offering.maxCapacity}` : ""} ظرفیت
            </span>
          </div>
          <StudentsPanel
            isMeLoading={isMeLoading}
            visible={visible}
            hasProfile={hasProfile}
            isLoading={isLoading}
            isError={isError}
            error={error}
            isForbidden={isForbidden}
            students={students}
            hasNextPage={!!hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onNext={() => fetchNextPage()}
            onGo={goSettings}
          />
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

function StudentsPanel(props: {
  isMeLoading: boolean
  visible: boolean
  hasProfile: boolean
  isLoading: boolean
  isError: boolean
  error: unknown
  isForbidden: boolean
  students: import("@/lib/api").CourseStudent[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onNext: () => void
  onGo: () => void
}) {
  if (props.isMeLoading) return <StudentsLoading />
  if (!props.visible) return <StudentsHidden onGo={props.onGo} />
  if (!props.hasProfile) return <StudentsNoProfile onGo={props.onGo} />
  if (props.isLoading) return <StudentsLoading />
  if (props.isError) return <StudentsError message={(props.error as Error)?.message ?? "خطا در دریافت لیست"} isForbidden={props.isForbidden} />
  if (props.students.length === 0) return <StudentsEmpty />
  return <StudentsList students={props.students} hasNextPage={props.hasNextPage} isFetchingNextPage={props.isFetchingNextPage} onNext={props.onNext} />
}
