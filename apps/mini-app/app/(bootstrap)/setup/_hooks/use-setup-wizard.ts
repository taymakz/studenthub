"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { updateProfile, type UniversityIndexEntry } from "@/lib/api"
import { isProfileComplete } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"
import { useCurrentSemesterTerms } from "./use-current-semester-terms"

export const STEPS = [
  "University",
  "Major",
  "Degree",
  "EntryYear",
  "Semester",
  "Gender",
  "Term",
  "CurrentSemester",
  "IsLastTerm",
] as const
export type Step = (typeof STEPS)[number]

export interface WizardData {
  university?: UniversityIndexEntry
  majorSlug?: string
  majorName?: string
  degree?: string
  degreeName?: string
  entryYearRange?: string
  entrySemester?: "MEHR" | "BAHMAN" | "SUMMER"
  gender?: "MALE" | "FEMALE"
  termNumber?: number
  currentSemesterCode?: string
  isLastTerm?: boolean
}

export function useSetupWizard() {
  const router = useRouter()
  const qc = useQueryClient()
  const [stepIndex, setStepIndex] = React.useState(0)
  const [direction, setDirection] = React.useState(1)
  const [saving, setSaving] = React.useState(false)
  const step: Step = STEPS[stepIndex] ?? "University"
  const isLastStep = stepIndex === STEPS.length - 1
  const [data, setData] = React.useState<WizardData>({})

  const profile = useProfileStore((s) => s.profile)
  const isSetupComplete = isProfileComplete(profile ?? null)

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })
  }, [stepIndex])

  const { terms: currentSemesterTerms, query: currentSemesterTermsQuery } = useCurrentSemesterTerms(
    data.university?.slug,
    data.majorSlug
  )

  // Derived (not synced into state): when the user reaches the
  // CurrentSemester step without picking one, preselect the latest term.
  // Consumers read `effectiveCurrentSemesterCode`; explicit user choice
  // always wins. Avoids a setState-in-effect cascading render.
  const effectiveCurrentSemesterCode =
    data.currentSemesterCode ??
    (currentSemesterTerms.length > 0
      ? [...currentSemesterTerms.map((t) => t.termCode)]
          .sort((a, b) => a.localeCompare(b))
          .at(-1)
      : undefined)

  const canGoForward = (): boolean => {
    switch (step) {
      case "University":
        return Boolean(data.university)
      case "Major":
        return Boolean(data.majorSlug)
      case "Degree":
        return Boolean(data.degree)
      case "EntryYear":
        return Boolean(data.entryYearRange)
      case "Semester":
        return Boolean(data.entrySemester)
      case "Gender":
        return Boolean(data.gender)
      case "Term":
        return true
      case "CurrentSemester":
        return true
      case "IsLastTerm":
        return true
      default:
        return false
    }
  }

  const moveSteps = (delta: number) => {
    if (delta > 0 && !canGoForward()) return
    setDirection(delta < 0 ? -1 : 1)
    setStepIndex((i) => Math.min(Math.max(i + delta, 0), STEPS.length - 1))
  }

  const goBack = () => {
    if (stepIndex === 0) {
      if (isSetupComplete) router.replace("/profile")
      return
    }
    const prev: Step | undefined = STEPS[stepIndex - 1]
    if (!prev) return
    const prevIdx = STEPS.indexOf(prev)
    setData((prevData) => {
      const next = { ...prevData }
      if (prevIdx <= STEPS.indexOf("Major")) {
        next.majorSlug = undefined
        next.majorName = undefined
      }
      if (prevIdx <= STEPS.indexOf("Degree")) {
        next.degree = undefined
        next.degreeName = undefined
      }
      if (prevIdx <= STEPS.indexOf("EntryYear")) {
        next.entryYearRange = undefined
      }
      if (prevIdx <= STEPS.indexOf("Semester")) {
        next.entrySemester = undefined
      }
      if (prevIdx <= STEPS.indexOf("Gender")) {
        next.gender = undefined
      }
      if (prevIdx <= STEPS.indexOf("Term")) {
        next.termNumber = undefined
      }
      if (prevIdx <= STEPS.indexOf("CurrentSemester")) {
        next.currentSemesterCode = undefined
      }
      if (prevIdx <= STEPS.indexOf("IsLastTerm")) {
        next.isLastTerm = undefined
      }
      return next
    })
    moveSteps(-1)
  }

  const goForward = () => {
    if (!canGoForward() || isLastStep) return
    moveSteps(1)
  }

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!data.university || !data.majorSlug || !data.degree || !data.entryYearRange || !data.entrySemester || !data.gender) {
        throw new Error("لطفا همه گزینه‌ها را کامل کنید")
      }
      const termNumber = data.termNumber ?? undefined
      const currentSemesterCode = data.currentSemesterCode ?? effectiveCurrentSemesterCode
      return updateProfile({
        universitySlug: data.university.slug,
        majorSlug: data.majorSlug,
        degree: data.degree,
        entryYearRange: data.entryYearRange,
        entrySemester: data.entrySemester,
        gender: data.gender,
        ...(termNumber !== undefined ? { termNumber } : {}),
        ...(currentSemesterCode ? { currentSemesterCode } : {}),
        ...(data.isLastTerm !== undefined ? { isLastTerm: data.isLastTerm } : {}),
      })
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["me"] })
      await useProfileStore.getState().refresh()
      router.replace("/profile")
    },
  })

  const submit = () => {
    if (!canGoForward()) return
    setSaving(true)
    submitMut.mutate(undefined, { onSettled: () => setSaving(false) })
  }

  const selectAndMaybeAdvance = (patch: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...patch }))
  }

  const advanceOnDoubleTap = () => {
    if (isLastStep) submit()
    else moveSteps(1)
  }

  return {
    step,
    stepIndex,
    direction,
    saving,
    data,
    setData,
    isLastStep,
    isSetupComplete,
    canGoForward,
    goBack,
    goForward,
    moveSteps,
    submit,
    submitMut,
    selectAndMaybeAdvance,
    advanceOnDoubleTap,
    currentSemesterTerms,
    currentSemesterTermsQuery,
    effectiveCurrentSemesterCode,
  }
}
