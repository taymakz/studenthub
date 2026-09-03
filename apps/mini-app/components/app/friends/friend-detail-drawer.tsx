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
import { cn } from "@workspace/ui/lib/utils"

import { SettingsRow } from "@/components/app/theme/settings-row"
import { CourseCard } from "@/components/app/courses/course-card"
import { useNotedSort } from "@/components/app/courses/noted/use-noted-sort"
import { ExamGroups } from "@/components/app/profile/exam/exam-groups"
import { groupByExamDate } from "@/components/app/profile/exam-schedule"
import { WeeklyGroups } from "@/components/app/profile/weekly/weekly-groups"
import { groupByWeekday } from "@/components/app/profile/export-canvas"
import { extractWeekday } from "@/components/app/profile/schedule-util"
import { OfferingsEmpty } from "@/components/app/profile/use-noted-offerings"
import { flattenChart, uniqueTerms, type ChartCourseItem } from "@/lib/chart"
import { parseTermCode } from "@/lib/term"
import { useProfileStore } from "@/stores/profile-store"
import {
  fetchOfferings,
  type Offering,
} from "@/lib/api"
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

/** View-only chip — same look as the /profile passed/failed chips. */
function ViewChip({ c, tone }: { c: ChartCourseItem; tone: "passed" | "failed" }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-start text-sm font-medium",
        tone === "passed"
          ? "border-success/50 bg-success/10 text-success"
          : "border-warning bg-warning/10 text-warning"
      )}
    >
      <p>{c.name}</p>
      {c.units > 0 ? (
        <p className="text-muted-foreground">{c.units} واحد</p>
      ) : null}
    </div>
  )
}

/**
 * Passed/failed groups — same term/moaref/unknown grouping and flex-wrap
 * layout as /profile (graduate-progress / failed-courses), view-only and
 * without search.
 */
function FriendCourseGroups({
  names,
  tone,
  pool,
  emptyMessage,
}: {
  names: string[]
  tone: "passed" | "failed"
  pool: ChartCourseItem[]
  emptyMessage: string
}) {
  const set = new Set(names)
  const items = pool.filter((c) => set.has(c.name))
  const tracked = new Set(items.map((c) => c.name))
  const extra: ChartCourseItem[] = names
    .filter((n) => !tracked.has(n))
    .map((name) => ({
      name,
      code: "",
      units: 0,
      termNumber: undefined,
      isMoaref: false,
      isUnknown: true,
    }))

  const terms = uniqueTerms(items)
  const moaref = items.filter((c) => c.isMoaref)
  const unknown = [...items.filter((c) => c.isUnknown), ...extra]
  const termCourses = (t: number) =>
    items.filter((c) => !c.isMoaref && !c.isUnknown && c.termNumber === t)

  if (terms.length === 0 && moaref.length === 0 && unknown.length === 0) {
    return <FriendsEmpty message={emptyMessage} />
  }

  return (
    <div className="flex flex-col gap-4">
      {terms.map((term) => (
        <div key={term} className="flex flex-col gap-2">
          <h3 className="text-center font-medium text-primary">
            دروس ترم <span className="font-sans text-sm">{term}</span>
          </h3>
          <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
            {termCourses(term).map((c) => (
              <ViewChip key={`${term}-${c.name}`} c={c} tone={tone} />
            ))}
          </div>
        </div>
      ))}
      {moaref.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-center font-medium text-blue-600 dark:text-blue-400">
            دروس معارف
          </h3>
          <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
            {moaref.map((c) => (
              <ViewChip key={`m-${c.name}`} c={c} tone={tone} />
            ))}
          </div>
        </div>
      )}
      {unknown.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-center font-medium text-yellow-600 dark:text-yellow-400">
            دروس ناشناس
          </h3>
          <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
            {unknown.map((c) => (
              <ViewChip key={`u-${c.name}`} c={c} tone={tone} />
            ))}
          </div>
        </div>
      )}
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

  // Viewer's own نیم‌سال — the friend's noted list is filtered to it.
  const myTermCode = useProfileStore((s) => s.termCode)
  const parsed = myTermCode ? parseTermCode(myTermCode) : null
  const viewerNoted = (detail.data?.noted ?? []).filter(
    (n) =>
      !parsed || (n.year === String(parsed.year) && n.semester === parsed.semester)
  )

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

  const notedIdx = new Set(viewerNoted.map((n) => n.courseIndex))
  const notedOfferings: Offering[] = (
    offeringsQuery.data?.offerings ?? []
  ).filter((o) => notedIdx.has(o.index))
  const weekly = groupByWeekday(
    notedOfferings,
    (o) => extractWeekday(o.classSchedule) ?? "نامشخص"
  )
  const exams = groupByExamDate(notedOfferings)
  const sortedNoted = useNotedSort(notedOfferings)
  const totalUnits = sortedNoted.reduce(
    (s, o) => s + o.theoreticalUnits + o.practicalUnits,
    0
  )

  const pool = flattenChart(detail.data?.chart)
  const user = detail.data?.user ?? null
  const fullName = user
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : ""
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
                  description={`${viewerNoted.length} درس`}
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
        ) : notedOfferings.length === 0 ? (
          <OfferingsEmpty enabled isLoading={false} />
        ) : (
          <WeeklyGroups groups={weekly} onSelect={() => {}} />
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
        ) : notedOfferings.length === 0 ? (
          <OfferingsEmpty enabled isLoading={false} />
        ) : (
          <ExamGroups groups={exams} onSelect={() => {}} />
        )}
      </NestedDrawer>

      <NestedDrawer
        open={nested === "noted"}
        onOpenChange={(o) => !o && setNested(null)}
        title="لیست یادداشت"
        description={
          sortedNoted.length > 0
            ? `${fullName} · جمع واحدها: ${totalUnits} واحد`
            : fullName
        }
      >
        {sortedNoted.length === 0 ? (
          <FriendsEmpty message="درسی در لیست یادداشت این نیم‌سال نیست." />
        ) : (
          <div className="space-y-4">
            {sortedNoted.map((o) => (
              <CourseCard
                key={o.index}
                offering={o}
                viewMode="full"
                onSelect={() => {}}
                flags={{ noted: true, passed: false, new: false }}
              />
            ))}
          </div>
        )}
      </NestedDrawer>

      <NestedDrawer
        open={nested === "passed"}
        onOpenChange={(o) => !o && setNested(null)}
        title="دروس پاس شده"
        description={fullName}
      >
        <FriendCourseGroups
          names={passed}
          tone="passed"
          pool={pool}
          emptyMessage="درسی پاس نشده است."
        />
      </NestedDrawer>

      <NestedDrawer
        open={nested === "failed"}
        onOpenChange={(o) => !o && setNested(null)}
        title="دروس مردود شده"
        description={fullName}
      >
        <FriendCourseGroups
          names={failed}
          tone="failed"
          pool={pool}
          emptyMessage="درسی مردود نشده است."
        />
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
