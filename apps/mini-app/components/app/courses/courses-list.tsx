"use client"

import { Virtuoso } from "react-virtuoso"

import type { Offering } from "@/lib/api"

import { CourseCard } from "./course-card"

export function CoursesList({
  filtered,
  notedIndexes,
  passedNames,
  newIndexes,
  viewMode,
  borderFor,
  onSelect,
}: {
  filtered: Offering[]
  notedIndexes: Set<string>
  passedNames: Set<string>
  newIndexes: Set<string>
  viewMode: "full" | "simple"
  borderFor: (o: Offering) => string
  onSelect: (o: Offering) => void
}) {
  return (
    <Virtuoso
      useWindowScroll
      data={filtered}
      computeItemKey={(_, o) => o.index}
      overscan={6}
      itemContent={(index, o) => (
        <div
          className="animate-fadeIn py-1.5"
          style={{
            animationDelay: `${Math.min(index * 30, 300)}ms`,
            animationFillMode: "backwards",
          }}
        >
          <CourseCard
            offering={o}
            isNoted={notedIndexes.has(o.index)}
            isPassed={passedNames.has(o.courseName)}
            isNew={newIndexes.has(o.index)}
            viewMode={viewMode}
            onSelect={onSelect}
            className={borderFor(o)}
          />
        </div>
      )}
    />
  )
}
