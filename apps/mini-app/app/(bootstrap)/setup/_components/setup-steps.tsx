"use client"

import type { MajorIndexEntry, UniversityIndexEntry } from "@/lib/api"

import {
  CurrentSemesterStep,
  DegreeStep,
  EntryYearStep,
  GenderStep,
  IsLastTermStep,
  MajorStep,
  SemesterStep,
  TermStep,
  UniversityStep,
} from "./steps"

export function SetupSteps({
  step,
  data,
  universities,
  filteredUnis,
  visibleUnis,
  uniSearch,
  setUniSearch,
  onSelectUniversity,
  onDoubleClickUniversity,
  onLoadMoreUnis,
  unisLoading,
  allMajors,
  filteredMajors,
  visibleMajors,
  majorSearch,
  setMajorSearch,
  onSelectMajor,
  onDoubleClickMajor,
  onLoadMoreMajors,
  majorsLoading,
  degrees,
  onSelectDegree,
  onDoubleClickDegree,
  yearOptions,
  onSelectYear,
  onDoubleClickYear,
  yearLoading,
  availableSemesters,
  onSelectSemester,
  onSelectGender,
  degreeForTerm,
  onSelectTerm,
  onDoubleClickTerm,
  currentSemesterTerms,
  onSelectCurrentSemester,
  onDoubleClickCurrentSemester,
  currentSemesterLoading,
  onSelectIsLastTerm,
}: {
  step: string
  data: {
    university?: UniversityIndexEntry
    majorSlug?: string
    degree?: string
    entryYearRange?: string
    entrySemester?: string
    gender?: string
    termNumber?: number
    currentSemesterCode?: string
    isLastTerm?: boolean
  }
  universities: UniversityIndexEntry[]
  filteredUnis: UniversityIndexEntry[]
  visibleUnis: UniversityIndexEntry[]
  uniSearch: string
  setUniSearch: (v: string) => void
  onSelectUniversity: (u: UniversityIndexEntry) => void
  onDoubleClickUniversity: (u: UniversityIndexEntry) => void
  onLoadMoreUnis: () => void
  unisLoading: boolean
  allMajors: MajorIndexEntry[]
  filteredMajors: MajorIndexEntry[]
  visibleMajors: MajorIndexEntry[]
  majorSearch: string
  setMajorSearch: (v: string) => void
  onSelectMajor: (m: MajorIndexEntry) => void
  onDoubleClickMajor: (m: MajorIndexEntry) => void
  onLoadMoreMajors: () => void
  majorsLoading: boolean
  degrees: Array<{ slug: string; name?: { fa: string } }>
  onSelectDegree: (slug: string, name?: string) => void
  onDoubleClickDegree: (slug: string, name?: string) => void
  yearOptions: Array<{ range: string; label: string }>
  onSelectYear: (range: string) => void
  onDoubleClickYear: (range: string) => void
  yearLoading: boolean
  availableSemesters: Array<"MEHR" | "BAHMAN" | "SUMMER">
  onSelectSemester: (v: "MEHR" | "BAHMAN" | "SUMMER") => void
  onSelectGender: (v: "MALE" | "FEMALE") => void
  degreeForTerm?: { termCount?: number; maxTermCount?: number }
  onSelectTerm: (n: number) => void
  onDoubleClickTerm: (n: number) => void
  currentSemesterTerms: Array<{ termCode: string; semester: string }>
  onSelectCurrentSemester: (v: string) => void
  onDoubleClickCurrentSemester: (v: string) => void
  currentSemesterLoading: boolean
  onSelectIsLastTerm: (v: boolean) => void
}) {
  if (step === "University") {
    return (
      <UniversityStep
        universities={universities}
        filteredUnis={filteredUnis}
        visibleUnis={visibleUnis}
        uniSearch={uniSearch}
        setUniSearch={setUniSearch}
        selectedSlug={data.university?.slug}
        onSelect={onSelectUniversity}
        onDoubleClick={onDoubleClickUniversity}
        onLoadMore={onLoadMoreUnis}
        isLoading={unisLoading}
      />
    )
  }
  if (step === "Major") {
    return (
      <MajorStep
        allMajors={allMajors}
        filteredMajors={filteredMajors}
        visibleMajors={visibleMajors}
        majorSearch={majorSearch}
        setMajorSearch={setMajorSearch}
        selectedSlug={data.majorSlug}
        onSelect={onSelectMajor}
        onDoubleClick={onDoubleClickMajor}
        onLoadMore={onLoadMoreMajors}
        isLoading={majorsLoading}
      />
    )
  }
  if (step === "Degree") {
    return <DegreeStep degrees={degrees} selected={data.degree} onSelect={onSelectDegree} onDoubleClick={onDoubleClickDegree} />
  }
  if (step === "EntryYear") {
    return <EntryYearStep yearOptions={yearOptions} selected={data.entryYearRange} onSelect={onSelectYear} onDoubleClick={onDoubleClickYear} isLoading={yearLoading} />
  }
  if (step === "Semester") {
    return <SemesterStep availableSemesters={availableSemesters} selected={data.entrySemester} onSelect={onSelectSemester} />
  }
  if (step === "Gender") {
    return <GenderStep selected={data.gender} onSelect={onSelectGender} />
  }
  if (step === "Term") {
    return <TermStep degree={degreeForTerm} selected={data.termNumber} onSelect={onSelectTerm} onDoubleClick={onDoubleClickTerm} />
  }
  if (step === "CurrentSemester") {
    return <CurrentSemesterStep terms={currentSemesterTerms} selected={data.currentSemesterCode} onSelect={onSelectCurrentSemester} onDoubleClick={onDoubleClickCurrentSemester} isLoading={currentSemesterLoading} />
  }
  if (step === "IsLastTerm") {
    return <IsLastTermStep selected={data.isLastTerm} onSelect={onSelectIsLastTerm} />
  }
  return null
}
