"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { VirtuosoGrid } from "react-virtuoso"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHeader } from "@/components/page-header"
import { UserCard } from "@/components/users/user-card"
import { FilterMultiSelect } from "@/components/users/filter-multiselect"
import { useMajors, useUniversities, useUsersInfinite } from "@/hooks/use-users"
import { useAuth } from "@/hooks/use-auth"
import type { PublicUser } from "@/services/users.service"

// ── Virtuoso: hoisted outside render (skill: never inline components) ──
// Border BETWEEN items on x+y (not inside Card) via item borders + clipping.
// Parent overflow-hidden + List -me-px -mb-px clips outer right/bottom.
// Responsive nth-child hides last-column's border-e per breakpoint:
// 1 col: single → hide none,  lg:3 cols → 3n,  xl:2 cols → 2n,  2xl:3 cols → 3n
const GridList = React.forwardRef<
  HTMLDivElement,
  { style?: React.CSSProperties; children?: React.ReactNode }
>(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    {...(props as Record<string, unknown>)}
    style={
      {
        display: "flex",
        flexWrap: "wrap",
        gap: "0px",
        ...style,
      } as React.CSSProperties
    }
    className="-me-px -mb-px flex flex-wrap overflow-hidden bg-card"
  >
    {children as React.ReactNode}
  </div>
))
GridList.displayName = "GridList"

const GridItem: React.FC<{
  style?: React.CSSProperties
  children?: React.ReactNode
}> = ({ children, ...props }) => (
  <div
    {...(props as Record<string, unknown>)}
    className="w-full flex-none overflow-hidden border-e border-b border-border bg-card p-0 lg:w-1/3 xl:w-1/2 2xl:w-1/3 xl:[&:nth-child(2n)]:border-e-0 2xl:[&:nth-child(2n)]:border-e lg:[&:nth-child(3n)]:border-e-0 xl:[&:nth-child(3n)]:border-e 2xl:[&:nth-child(3n)]:border-e-0"
    style={
      {
        display: "flex",
        flex: "none",
        alignContent: "stretch",
        boxSizing: "border-box",
        overflow: "hidden",
        ...(props.style ?? {}),
      } as React.CSSProperties
    }
  >
    <div
      style={{
        display: "flex",
        flex: 1,
        minWidth: 0,
        backgroundColor: "hsl(var(--card))",
      }}
    >
      {children}
    </div>
  </div>
)

const GridScroller = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ style, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={{ ...(style as React.CSSProperties), overflow: "visible" }}
  />
))
GridScroller.displayName = "GridScroller"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gridComponents: any = {
  Scroller: GridScroller,
  List: GridList,
  Item: GridItem,
}

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

function useGridCols(): number {
  const getCols = React.useCallback(() => {
    if (typeof window === "undefined") return 3
    const w = window.innerWidth
    if (w >= 1536) return 3 // 2xl
    if (w >= 1280) return 2 // xl
    if (w >= 1024) return 3 // lg
    return 1
  }, [])
  const [cols, setCols] = React.useState(getCols)
  React.useEffect(() => {
    const onResize = () => setCols(getCols())
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [getCols])
  return cols
}

// Stable helpers outside component (vercel: rerender-memo, no inline arrow)
const computeKey = (_: number, u: PublicUser) => (u as PublicUser).id
const MemoUserCard = React.memo(UserCard, (prev, next) => {
  const a = prev.user
  const b = next.user
  return (
    a.id === b.id &&
    a.banned === b.banned &&
    a.role === b.role &&
    a.isContributor === b.isContributor &&
    a.lastOnlineAt === b.lastOnlineAt &&
    a.photoUrl === b.photoUrl &&
    a.telegramUsername === b.telegramUsername &&
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.profile?.universitySlug === b.profile?.universitySlug &&
    a.profile?.majorSlug === b.profile?.majorSlug &&
    a.profile?.gender === b.profile?.gender
  )
})

export default function UsersPage() {
  const { user: me } = useAuth() as unknown as { user: { role: string } | null }
  const canView = me?.role === "ADMIN" || me?.role === "SUPERADMIN"
  const [q, setQ] = React.useState("")
  const debouncedQ = useDebounced(q, 350)
  // useDeferredValue keeps input responsive while list filters (vercel rerender-use-deferred-value)
  const deferredQ = React.useDeferredValue(debouncedQ)
  const [universitiesSel, setUniversitiesSel] = React.useState<string[]>([])
  const [majorsSel, setMajorsSel] = React.useState<string[]>([])
  const [gender, setGender] = React.useState<string>("")
  const [live, setLive] = React.useState(false)
  const [scrollParent, setScrollParent] = React.useState<HTMLElement | null>(
    null
  )
  const cols = useGridCols()
  const [, startTransition] = React.useTransition()

  React.useEffect(() => {
    const el = document.querySelector(
      "main.content-scroll"
    ) as HTMLElement | null
    setScrollParent(el)
  }, [])

  // useTransition for non-urgent filter updates (keeps list from blocking input)
  const handleUniversities = React.useCallback((v: string[]) => {
    startTransition(() => setUniversitiesSel(v))
  }, [])
  const handleMajors = React.useCallback((v: string[]) => {
    startTransition(() => setMajorsSel(v))
  }, [])
  const handleGender = React.useCallback((v: string | null) => {
    startTransition(() => setGender((v as string) ?? ""))
  }, [])

  const params = React.useMemo(
    () => ({
      ...(deferredQ.trim() ? { q: deferredQ.trim() } : {}),
      ...(universitiesSel.length > 0 ? { university: universitiesSel } : {}),
      ...(majorsSel.length > 0 ? { major: majorsSel } : {}),
      ...(gender ? { gender: gender as "MALE" | "FEMALE" } : {}),
      sort: "lastActivity" as const,
      limit: 36, // divisible by 3 and 2 (lg:3 xl:2 2xl:3) -> no orphan in last row
    }),
    [deferredQ, universitiesSel, majorsSel, gender]
  )

  const {
    users,
    total,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useUsersInfinite(params, { live })

  const { data: universities } = useUniversities()
  const { data: allMajors } = useMajors()

  const uniOptions = React.useMemo(
    () =>
      (universities ?? []).map((u) => ({ value: u.slug, label: u.name.fa })),
    [universities]
  )

  const majorOptions = React.useMemo(() => {
    if (!allMajors) return []
    const filtered =
      universitiesSel.length === 0
        ? allMajors
        : allMajors.filter((m) => universitiesSel.includes(m.uniSlug))
    const map = new Map<string, string>()
    for (const m of filtered) if (!map.has(m.slug)) map.set(m.slug, m.name.fa)
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [allMajors, universitiesSel])

  React.useEffect(() => {
    if (universitiesSel.length === 0) return
    if (!allMajors) return
    const valid = new Set(
      allMajors
        .filter((m) => universitiesSel.includes(m.uniSlug))
        .map((m) => m.slug)
    )
    setMajorsSel((prev) => {
      const next = prev.filter((v) => valid.has(v))
      return next.length === prev.length ? prev : next
    })
  }, [universitiesSel, allMajors])

  // Hoisted callbacks (virtuoso skill: no inline arrow in props)
  const handleEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleRefresh = React.useCallback(() => {
    void refetch()
  }, [refetch])

  const renderItem = React.useCallback(
    (_: number, user: PublicUser) => (
      <MemoUserCard user={user as PublicUser} onRoleChanged={handleRefresh} />
    ),
    [handleRefresh]
  )

  // xl plain-grid infinite sentinel (no virtuoso there)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (cols !== 2) return
    if (!scrollParent) return
    if (!hasNextPage) return
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage()
      },
      { root: scrollParent, rootMargin: "800px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [cols, scrollParent, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (me && !canView) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="کاربران" />
        <div className="p-6 text-center text-sm text-muted-foreground">
          دسترسی فقط برای ادمین و سوپرادمین
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col overflow-x-hidden">
      <PageHeader title="کاربران">
        <span className="text-xs text-muted-foreground">
          {total.toLocaleString("fa-IR")} نفر
        </span>
      </PageHeader>

      {/* Filters - bg-secondary */}
      <div className="sticky top-11 z-10 shrink-0 overflow-x-clip border-b bg-secondary">
        <div className="flex flex-col gap-2 p-4 lg:p-6">
          <div className="flex [scrollbar-width:none] flex-wrap items-center gap-2 overflow-x-clip [&::-webkit-scrollbar]:hidden">
            <div className="relative min-w-[200px] flex-1 overflow-x-clip sm:max-w-[280px]">
              <Search className="absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="جستجو نام یا یوزرنیم..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 pe-8 text-sm"
              />
            </div>

            <FilterMultiSelect
              options={uniOptions}
              value={universitiesSel}
              onChange={handleUniversities}
              placeholder="دانشگاه"
              searchPlaceholder="جستجوی دانشگاه..."
            />
            <FilterMultiSelect
              options={majorOptions}
              value={majorsSel}
              onChange={handleMajors}
              placeholder="رشته"
              searchPlaceholder="جستجوی رشته..."
            />

            <div className="flex items-center gap-1">
              <Select value={gender} onValueChange={handleGender}>
                <SelectTrigger className="h-8 w-[130px] text-sm">
                  <SelectValue placeholder="جنسیت">
                    {gender === "MALE"
                      ? "آقا"
                      : gender === "FEMALE"
                        ? "خانم"
                        : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">آقا</SelectItem>
                  <SelectItem value="FEMALE">خانم</SelectItem>
                </SelectContent>
              </Select>
              {gender && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => handleGender("")}
                  aria-label="پاک کردن فیلتر جنسیت"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>

            <Button
              variant={live ? "default" : "outline"}
              size="sm"
              className="ms-auto h-8 shrink-0 touch-manipulation select-none"
              onClick={() => setLive((v) => !v)}
            >
              بروزرسانی مداوم
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden">
        {isLoading ? (
          <div className="-me-px -mb-px grid grid-cols-1 gap-0 overflow-hidden border-border lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="flex h-[280px] gap-4 overflow-hidden rounded-none border-e border-b border-border bg-card p-4 ring-0 [&:last-child]:border-b-0 xl:[&:nth-child(2n)]:border-e-0 2xl:[&:nth-child(2n)]:border-e lg:[&:nth-child(3n)]:border-e-0 xl:[&:nth-child(3n)]:border-e 2xl:[&:nth-child(3n)]:border-e-0"
              >
                <Skeleton className="size-32 shrink-0 rounded-full sm:size-40" />
                <div className="flex flex-1 flex-col gap-2 pt-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-20" />
                  <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                  <Skeleton className="mt-auto h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="mb-3 size-10 opacity-30" />
            <p className="text-sm">کاربری یافت نشد</p>
          </div>
        ) : cols === 2 ? (
          // xl (1280-1535): 2 cols – plain grid avoids virtuoso 40% blank miscalc
          <>
            <div className="-me-px -mb-px grid grid-cols-2 gap-0 overflow-hidden">
              {users.map((user) => (
                <div
                  key={(user as PublicUser).id}
                  className="border-e border-b border-border bg-card [&:nth-child(2n)]:border-e-0"
                >
                  <MemoUserCard
                    user={user as PublicUser}
                    onRoleChanged={handleRefresh}
                  />
                </div>
              ))}
            </div>
            <div ref={sentinelRef} className="h-px w-full" aria-hidden />
            {isFetchingNextPage && (
              <div className="-me-px -mb-px grid grid-cols-2 gap-0 overflow-hidden">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={`next-${i}`}
                    className="flex h-[280px] animate-pulse gap-4 overflow-hidden rounded-none border-e border-b border-border bg-card p-4 ring-0 [&:nth-child(2n)]:border-e-0"
                  >
                    <Skeleton className="size-32 shrink-0 rounded-full sm:size-40" />
                    <div className="flex flex-1 flex-col gap-2 pt-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <VirtuosoGrid
              key={`cols-${cols}`}
              customScrollParent={scrollParent ?? undefined}
              data={users}
              computeItemKey={computeKey as any}
              components={gridComponents}
              endReached={handleEndReached}
              increaseViewportBy={400}
              overscan={12}
              itemContent={renderItem as any}
            />
            {isFetchingNextPage && (
              <div className="-me-px -mb-px grid grid-cols-1 gap-0 overflow-hidden lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={`next-${i}`}
                    className="flex h-[280px] animate-pulse gap-4 overflow-hidden rounded-none border-e border-b border-border bg-card p-4 ring-0 xl:[&:nth-child(2n)]:border-e-0 2xl:[&:nth-child(2n)]:border-e lg:[&:nth-child(3n)]:border-e-0 xl:[&:nth-child(3n)]:border-e 2xl:[&:nth-child(3n)]:border-e-0"
                  >
                    <Skeleton className="size-32 shrink-0 rounded-full sm:size-40" />
                    <div className="flex flex-1 flex-col gap-2 pt-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
