"use client"

import { findNewerSemesterCode, SEMESTER_FA } from "@/lib/term"

import { CoursesHeader } from "./courses-header"
import { SemesterDrawer } from "@/components/app/semester-drawer"
import type { OfferingTerm } from "@/lib/api"

export function CoursesToolbar({
  search,
  onSearchChange,
  filterCount,
  resultCount,
  onOpenFilter,
  onOpenViewMode,
  termCode,
  terms,
  profileLine,
  semesterPickerOpen,
  onSemesterPickerOpenChange,
}: {
  search: string
  onSearchChange: (v: string) => void
  filterCount: number
  resultCount: number
  onOpenFilter: () => void
  onOpenViewMode: () => void
  termCode: string | null | undefined
  terms: OfferingTerm[]
  profileLine: string
  semesterPickerOpen: boolean
  onSemesterPickerOpenChange: (v: boolean) => void
}) {
  const newerCode = findNewerSemesterCode(
    termCode,
    terms.map((t: { termCode: string }) => t.termCode)
  )
  const hasNewTerm = Boolean(newerCode && newerCode !== termCode)

  return (
    <>
      <CoursesHeader
        search={search}
        onSearchChange={onSearchChange}
        filterCount={filterCount}
        resultCount={resultCount}
        onOpenFilter={onOpenFilter}
        onOpenViewMode={onOpenViewMode}
      />
      <button
        type="button"
        onClick={() => onSemesterPickerOpenChange(true)}
        className="flex w-full cursor-pointer flex-wrap items-center justify-center gap-1 bg-muted/50 py-1.5 text-center text-xs text-muted-foreground"
      >
        {hasNewTerm && (
          <span className="inline-flex items-center text-[10px] leading-none text-warning">
            نیم سال جدید اضافه شد ·
          </span>
        )}
        <span className="tabular-nums">
          {termCode
            ? `${termCode} ${SEMESTER_FA[terms.find((t) => t.termCode === termCode)?.semester as keyof typeof SEMESTER_FA] ?? ""} دروس نیمسال`.trim()
            : profileLine || "پروفایل دانشگاهی"}
        </span>
      </button>
      <SemesterDrawer open={semesterPickerOpen} onOpenChange={onSemesterPickerOpenChange} />
    </>
  )
}
