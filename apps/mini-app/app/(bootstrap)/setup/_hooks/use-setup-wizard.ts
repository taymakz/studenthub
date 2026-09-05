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

  // Auto-advance/submit timers (Semester/Gender/Term/CurrentSemester/IsLastTerm
  // steps select + then advance/submit after a short delay). A double-click
  // fires the select handler TWICE — without the dedup below each call
  // schedules its own timer and the wizard skips TWO steps (or submits twice).
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const submittingRef = React.useRef(false)

  const clearAdvanceTimer = React.useCallback(() => {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }, [])

  React.useEffect(() => clearAdvanceTimer, [clearAdvanceTimer])

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
      // Chain-safe resolution: a field falls back to the SAVED profile only
      // while its whole upstream chain is untouched. Once the user picks a
      // different upstream value (e.g. a new university), downstream fields
      // MUST come from the wizard — the gated steps guarantee they were
      // re-picked. This makes the completeness guard structurally unable to
      // submit a mismatched mix of new and saved values, and unable to fail
      // spuriously for editing users.
      const uniChanged =
        data.university != null && data.university.slug !== profile?.universitySlug
      const majorChanged =
        data.majorSlug != null && data.majorSlug !== profile?.majorSlug
      const degreeChanged = data.degree != null && data.degree !== profile?.degree
      const yearChanged =
        data.entryYearRange != null && data.entryYearRange !== profile?.entryYearRange
      const uniUpstreamClean = !uniChanged
      const majorUpstreamClean = uniUpstreamClean && !majorChanged
      const degreeUpstreamClean = majorUpstreamClean && !degreeChanged
      const yearUpstreamClean = degreeUpstreamClean && !yearChanged

      const universitySlug = data.university?.slug ?? profile?.universitySlug ?? undefined
      const majorSlug =
        data.majorSlug ?? (uniUpstreamClean ? profile?.majorSlug : undefined) ?? undefined
      const degree =
        data.degree ??
        (majorUpstreamClean ? profile?.degree : undefined)
      const entryYearRange =
        data.entryYearRange ??
        (degreeUpstreamClean ? profile?.entryYearRange : undefined)
      const entrySemester =
        data.entrySemester ??
        (yearUpstreamClean ? profile?.entrySemester : undefined)
      const gender = data.gender ?? profile?.gender ?? undefined

      // Guarding each const directly lets TS narrow them for the payload.
      const missing: string[] = []
      if (!universitySlug) missing.push("دانشگاه")
      if (!majorSlug) missing.push("رشته")
      if (!degree) missing.push("مقطع")
      if (!entryYearRange) missing.push("سال ورود")
      if (!entrySemester) missing.push("ترم ورود")
      if (!gender) missing.push("جنسیت")
      if (
        !universitySlug ||
        !majorSlug ||
        !degree ||
        !entryYearRange ||
        !entrySemester ||
        !gender
      ) {
        throw new Error(`لطفا همه گزینه‌ها را کامل کنید: ${missing.join("، ")}`)
      }

      const termNumber = data.termNumber ?? profile?.termNumber ?? undefined
      const currentSemesterCode =
        data.currentSemesterCode ?? effectiveCurrentSemesterCode
      const isLastTerm = data.isLastTerm ?? (profile?.isLastTerm || undefined)
      return updateProfile({
        universitySlug,
        majorSlug,
        degree,
        entryYearRange,
        entrySemester,
        gender,
        ...(termNumber !== undefined ? { termNumber } : {}),
        ...(currentSemesterCode ? { currentSemesterCode } : {}),
        ...(isLastTerm !== undefined ? { isLastTerm } : {}),
      })
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["me"] })
      await useProfileStore.getState().refresh()
      router.replace("/profile")
    },
  })

  const submit = React.useCallback(() => {
    if (submittingRef.current) return
    submittingRef.current = true
    submitMut.mutate(undefined, {
      onSettled: () => {
        submittingRef.current = false
        setSaving(false)
      },
    })
    setSaving(true)
  }, [submitMut])

  const selectAndMaybeAdvance = (patch: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...patch }))
  }

  /** Select + auto-advance exactly ONCE, no matter how many times the
   *  select handler fires (single click, double-click, chip re-tap). */
  const selectAndAdvance = (patch: Partial<WizardData>, delayMs = 120) => {
    setData((prev) => ({ ...prev, ...patch }))
    clearAdvanceTimer()
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null
      setDirection(1)
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
    }, delayMs)
  }

  /** Select + submit exactly once (last step). */
  const selectAndSubmit = (patch: Partial<WizardData>, delayMs = 120) => {
    setData((prev) => ({ ...prev, ...patch }))
    clearAdvanceTimer()
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null
      submitRef.current()
    }, delayMs)
  }

  // Stable ref so the timer callback always reaches the latest submit.
  const submitRef = React.useRef(submit)
  React.useEffect(() => {
    submitRef.current = submit
  }, [submit])

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
    selectAndAdvance,
    selectAndSubmit,
    advanceOnDoubleTap,
    currentSemesterTerms,
    currentSemesterTermsQuery,
    effectiveCurrentSemesterCode,
  }
}
