"use client"

import type { Offering } from "@/lib/api"
import { Skeleton } from "@workspace/ui/components/skeleton"

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
    </div>
  )
}
