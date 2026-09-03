"use client"

import { useState } from "react"

import type { Offering } from "@/lib/api"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useProfileStore } from "@/stores/profile-store"
import { useFriendsCoursesMap } from "@/components/app/friends/use-friends-data"
import { CourseMatesDrawer } from "@/components/app/friends/friend-course-mates-drawer"
import { CoursesEmptyStates } from "./courses-empty-states"
import { CoursesList } from "./courses-list"

export function CoursesContent({
  isLoading,
  complete,
  termCode,
  offeringsLength,
  filtered,
  filterCount,
  search,
  totalMatching,
  lastUpdated,
  notedIndexes,
  passedNames,
  newIndexes,
  viewMode,
  borderFor,
  onSelect,
  onClearFilters,
}: {
  isLoading: boolean
  complete: boolean
  termCode: string | null | undefined
  offeringsLength: number
  filtered: Offering[]
  filterCount: number
  search: string
  totalMatching: number
  lastUpdated: string
  notedIndexes: Set<string>
  passedNames: Set<string>
  newIndexes: Set<string>
  viewMode: "full" | "simple"
  borderFor: (o: Offering) => string
  onSelect: (o: Offering) => void
  onClearFilters: () => void
}) {
  const [matesFor, setMatesFor] = useState<Offering | null>(null)
  const profile = useProfileStore((s) => s.profile)
  const matesQuery = useFriendsCoursesMap(
    profile?.universitySlug,
    profile?.majorSlug,
    termCode,
    complete && Boolean(termCode)
  )
  const matesByIndex = new Map(
    (matesQuery.data ?? []).map((e) => [e.courseIndex, e])
  )

  return (
    <div className="container mx-auto space-y-3 px-4 pt-5">
      <div className="flex justify-between text-sm text-muted-foreground">
        <p>دروس ارائه شده تا الان: {totalMatching}</p>
        <p>آخرین بروزرسانی {lastUpdated}</p>
      </div>

      {isLoading ? (
        <div className="space-y-2 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-md" />
          ))}
        </div>
      ) : filtered.length > 0 && complete && Boolean(termCode) && offeringsLength > 0 ? (
        <CoursesList
          filtered={filtered}
          notedIndexes={notedIndexes}
          passedNames={passedNames}
          newIndexes={newIndexes}
          viewMode={viewMode}
          borderFor={borderFor}
          onSelect={onSelect}
          matesByIndex={matesByIndex}
          onMatesClick={setMatesFor}
        />
      ) : (
        <CoursesEmptyStates
          isLoading={false}
          complete={complete}
          termCode={termCode}
          offeringsLength={offeringsLength}
          filteredLength={filtered.length}
          filterCount={filterCount}
          search={search}
          onClearFilters={onClearFilters}
        />
      )}
      <CourseMatesDrawer
        offering={matesFor}
        uni={profile?.universitySlug}
        major={profile?.majorSlug}
        termCode={termCode}
        open={!!matesFor}
        onOpenChange={(o) => !o && setMatesFor(null)}
      />
    </div>
  )
}
