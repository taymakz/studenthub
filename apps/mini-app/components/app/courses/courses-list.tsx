"use client"

import { Virtuoso } from "react-virtuoso"

import type { FriendCard, Offering } from "@/lib/api"

import { CourseCard } from "./course-card"
import { FriendFaces } from "@/components/app/friends/friend-faces"

export function CoursesList({
  filtered,
  notedIndexes,
  passedNames,
  newIndexes,
  viewMode,
  borderFor,
  onSelect,
  matesByIndex,
  onMatesClick,
}: {
  filtered: Offering[]
  notedIndexes: Set<string>
  passedNames: Set<string>
  newIndexes: Set<string>
  viewMode: "full" | "simple"
  borderFor: (o: Offering) => string
  onSelect: (o: Offering) => void
  matesByIndex?: Map<string, { count: number; sample: FriendCard[] }>
  onMatesClick?: (o: Offering) => void
}) {
  return (
    <Virtuoso
      useWindowScroll
      data={filtered}
      computeItemKey={(_, o) => o.index}
      overscan={6}
      itemContent={(index, o) => (
        <div
          className="relative animate-fadeIn py-1.5"
          style={{
            animationDelay: `${Math.min(index * 30, 300)}ms`,
            animationFillMode: "backwards",
          }}
        >
          <CourseCard
            offering={o}
            viewMode={viewMode}
            onSelect={onSelect}
            flags={{
              noted: notedIndexes.has(o.index),
              passed: passedNames.has(o.courseName),
              new: newIndexes.has(o.index),
            }}
            className={borderFor(o)}
          />
          {(() => {
            const mates = matesByIndex?.get(o.index)
            return mates && mates.count > 0 ? (
              <FriendFaces
                sample={mates.sample}
                count={mates.count}
                onClick={() => onMatesClick?.(o)}
              />
            ) : null
          })()}
        </div>
      )}
    />
  )
}
