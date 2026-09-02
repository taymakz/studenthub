"use client"

import { Users } from "lucide-react"

import { BooleanBadges } from "./information-badges"
import { RatingsGrid } from "./ratings-grid"

export function ProfessorInformation({
  professorName,
  total,
  averages,
  hideName,
  hasVoted,
}: {
  professorName: string
  total: number
  averages: {
    examDifficulty: number | null
    teachingQuality: number | null
    mastery: number | null
    leniency: number | null
    questionSimilarity: number | null
    providesSampleQuestions?: number | null
    providesNotes?: number | null
    mandatoryAttendance?: number | null
  } | null
  hideName?: boolean
  hasVoted?: boolean
}) {
  return (
    <div className="space-y-3">
      <ProfessorHeader
        professorName={professorName}
        total={total}
        hideName={hideName}
        hasVoted={hasVoted}
      />
      <BooleanBadges
        providesSampleQuestions={averages?.providesSampleQuestions}
        providesNotes={averages?.providesNotes}
        mandatoryAttendance={averages?.mandatoryAttendance}
      />
      <RatingsGrid averages={averages} />
    </div>
  )
}

function ProfessorHeader({
  professorName,
  total,
  hideName,
  hasVoted,
}: {
  professorName: string
  total: number
  hideName?: boolean
  hasVoted?: boolean
}) {
  return (
    <div
      className={`flex items-center ${hideName ? "justify-center" : "justify-between"}`}
    >
      {!hideName && (
        <h3 className="line-clamp-1 text-sm font-medium text-primary">
          {professorName}
        </h3>
      )}
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Users className="size-4" />
          {total} رأی
        </span>
        {hasVoted && (
          <span className="rounded-full bg-warning/10 px-2 py-px text-xs text-warning">
            رأی داده شده
          </span>
        )}
      </div>
    </div>
  )
}
