"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Ban,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CircleX,
  ClipboardList,
  UserMinus,
} from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { SettingsRow } from "@/components/app/theme/settings-row"
import {
  fetchOfferings,
  professorName,
  type Offering,
} from "@/lib/api"
import { groupByWeekday } from "@/components/app/profile/export-canvas"
import { groupByExamDate } from "@/components/app/profile/exam-schedule"
import { extractWeekday } from "@/components/app/profile/schedule-util"
import { ConfirmDrawer } from "./confirm-drawer"
import {
  FriendAvatar,
  FriendsEmpty,
  FriendsLoading,
  userSubtitle,
} from "./friend-rows"
import {
  useBlockUser,
  useFriendDetail,
  useUnfriend,
} from "./use-friends-data"

type Nested = "weekly" | "exam" | "noted" | "passed" | "failed" | null

function NestedDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description ? (
            <DrawerDescription>{description}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <DrawerPanel className="space-y-2 p-4">{children}</DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

function OfferingRow({ offering }: { offering: Offering }) {
  const professor = professorName(offering)
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-sm font-medium">{offering.courseName}</p>
      <p className="mt-1 text-xs text-muted-foreground" dir="auto">
        {offering.classSchedule ?? offering.examSchedule ?? ""}
      </p>
      {professor ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{professor}</p>
      ) : null}
    </div>
  )
}

/**
 * Friend detail drawer: big identity header, rows for the friend's weekly /
 * exam schedule, noted / passed / failed lists, plus block + unfriend.
 */
export function FriendDetailDrawer({
  friendId,
  open,
  onOpenChange,
}: {
  friendId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const detail = useFriendDetail(friendId, open)
  const unfriend = useUnfriend()
  const block = useBlockUser()
  const [confirm, setConfirm] = useState<"unfriend" | "block" | null>(null)
  const [nested, setNested] = useState<Nested>(null)

  const profile = detail.data?.profile
  const offeringsQuery = useQuery({
    queryKey: ["friend-offerings", friendId, profile?.currentSemesterCode],
    queryFn: async () =>
      (
        await fetchOfferings(
          profile!.universitySlug!,
          profile!.majorSlug!,
          profile!.currentSemesterCode!
        )
      ).data,
    enabled:
      open &&
      !!profile?.universitySlug &&
      !!profile?.majorSlug &&
      !!profile?.currentSemesterCode,
  })

  const notedIdx = new Set(detail.data?.noted.map((n) => n.courseIndex) ?? [])
  const notedOfferings = (offeringsQuery.data?.offerings ?? []).filter((o) =>
    notedIdx.has(o.index)
  )
  const weekly = groupByWeekday(
    notedOfferings,
    (o) => extractWeekday(o.classSchedule) ?? "نامشخص"
  )
  const exams = groupByExamDate(notedOfferings)
  const byIndex = new Map(notedOfferings.map((o) => [o.index, o]))

  const user = detail.data?.user ?? null
  const fullName = user
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : ""
  const noted = detail.data?.noted ?? []
  const passed = detail.data?.passed ?? []
  const failed = detail.data?.failed ?? []

  const closeAfterAction = {
    onSuccess: () => {
      setConfirm(null)
      onOpenChange(false)
    },
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader>
            <div className="flex flex-col items-center gap-2 pt-1">
              {user ? (
                <FriendAvatar user={user} size="xl" />
              ) : (
                <Skeleton className="size-16 rounded-full" />
              )}
              <DrawerTitle>{fullName || <Skeleton className="h-5 w-28" />}</DrawerTitle>
              {user ? (
                <DrawerDescription dir="ltr">
                  {userSubtitle(user)}
                </DrawerDescription>
              ) : null}
            </div>
          </DrawerHeader>
          <DrawerPanel className="p-0">
            {detail.isLoading || !user ? (
              <div className="p-4">
                <FriendsLoading />
              </div>
            ) : (
              <div className="mb-4 flex flex-col">
                <SettingsRow
                  icon={<CalendarDays className="size-5" />}
                  title="برنامه هفتگی"
                  description={`${notedOfferings.length} درس`}
                  onClick={() => setNested("weekly")}
                />
                <SettingsRow
                  icon={<CalendarClock className="size-5" />}
                  title="برنامه امتحانی"
                  description={`${notedOfferings.length} درس`}
                  onClick={() => setNested("exam")}
                />
                <SettingsRow
                  icon={<ClipboardList className="size-5" />}
                  title="لیست یادداشت"
                  description={`${noted.length} درس`}
                  onClick={() => setNested("noted")}
                />
                <SettingsRow
                  icon={<CircleCheck className="size-5" />}
                  title="دروس پاس شده"
                  description={`${passed.length} درس`}
                  onClick={() => setNested("passed")}
                />
                <SettingsRow
                  icon={<CircleX className="size-5" />}
                  title="دروس مردود شده"
                  description={`${failed.length} درس`}
                  onClick={() => setNested("failed")}
                />
                <div className="mx-4 border-t" />
                <button
                  type="button"
                  onClick={() => setConfirm("block")}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-5 text-start text-destructive"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Ban className="size-5" />
                  </span>
                  <span className="text-sm font-medium">مسدود کردن</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm("unfriend")}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-5 text-start text-destructive"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <UserMinus className="size-5" />
                  </span>
                  <span className="text-sm font-medium">حذف از دوستان</span>
                </button>
              </div>
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      <NestedDrawer
        open={nested === "weekly"}
        onOpenChange={(o) => !o && setNested(null)}
        title="برنامه هفتگی"
        description={fullName}
      >
        {offeringsQuery.isLoading ? (
          <FriendsLoading />
        ) : weekly.length === 0 ? (
          <FriendsEmpty message="برنامه هفتگی ثبت نشده است." />
        ) : (
          weekly.map((g) => (
            <div key={g.day}>
              <p className="px-1 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                {g.day}
              </p>
              <div className="space-y-2">
                {g.items.map((o) => (
                  <OfferingRow key={o.index} offering={o} />
                ))}
              </div>
            </div>
          ))
        )}
      </NestedDrawer>

      <NestedDrawer
        open={nested === "exam"}
        onOpenChange={(o) => !o && setNested(null)}
        title="برنامه امتحانی"
        description={fullName}
      >
        {offeringsQuery.isLoading ? (
          <FriendsLoading />
        ) : exams.length === 0 ? (
          <FriendsEmpty message="برنامه امتحانی ثبت نشده است." />
        ) : (
          exams.map((g) => (
            <div key={g.date}>
              <p className="px-1 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                {g.date}
              </p>
              <div className="space-y-2">
                {g.items.map((o) => (
                  <OfferingRow key={o.index} offering={o} />
                ))}
              </div>
            </div>
          ))
        )}
      </NestedDrawer>

      <NestedDrawer
        open={nested === "noted"}
        onOpenChange={(o) => !o && setNested(null)}
        title="لیست یادداشت"
        description={fullName}
      >
        {noted.length === 0 ? (
          <FriendsEmpty message="درسی در لیست یادداشت نیست." />
        ) : (
          noted.map((n) => {
            const o = byIndex.get(n.courseIndex)
            return (
              <div key={n.courseIndex} className="rounded-lg border bg-card p-3">
                <p className="text-sm font-medium">
                  {o?.courseName ?? `شماره ${n.courseIndex}`}
                </p>
                {o ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {o.theoreticalUnits + o.practicalUnits} واحد
                  </p>
                ) : null}
              </div>
            )
          })
        )}
      </NestedDrawer>

      <NestedDrawer
        open={nested === "passed"}
        onOpenChange={(o) => !o && setNested(null)}
        title="دروس پاس شده"
        description={fullName}
      >
        {passed.length === 0 ? (
          <FriendsEmpty message="درسی پاس نشده است." />
        ) : (
          passed.map((name) => (
            <div key={name} className="rounded-lg border bg-card p-3">
              <p className="text-sm font-medium">{name}</p>
            </div>
          ))
        )}
      </NestedDrawer>

      <NestedDrawer
        open={nested === "failed"}
        onOpenChange={(o) => !o && setNested(null)}
        title="دروس مردود شده"
        description={fullName}
      >
        {failed.length === 0 ? (
          <FriendsEmpty message="درسی مردود نشده است." />
        ) : (
          failed.map((name) => (
            <div key={name} className="rounded-lg border bg-card p-3">
              <p className="text-sm font-medium">{name}</p>
            </div>
          ))
        )}
      </NestedDrawer>

      <ConfirmDrawer
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "unfriend" ? "حذف از دوستان" : "مسدود کردن کاربر"}
        description={
          confirm === "unfriend"
            ? `${fullName} از لیست دوستان شما حذف می‌شود.`
            : `${fullName} مسدود می‌شود و از لیست دوستان حذف می‌گردد.`
        }
        confirmLabel={confirm === "unfriend" ? "حذف" : "مسدود کردن"}
        danger
        pending={
          confirm === "unfriend" ? unfriend.isPending : block.isPending
        }
        onConfirm={() => {
          if (friendId === null || !confirm) return
          if (confirm === "unfriend") unfriend.mutate(friendId, closeAfterAction)
          else block.mutate(friendId, closeAfterAction)
        }}
      />
    </>
  )
}
