"use client"

import * as React from "react"
import { AnimatePresence, m } from "motion/react"
import { ArrowRight, Loader2 } from "lucide-react"

import { useSelectedMajor } from "./_hooks/use-major-data"
import { useUniversityData } from "./_hooks/use-university-data"
import { useMajorData } from "./_hooks/use-major-data"
import { useYearData, useAvailableSemesters } from "./_hooks/use-year-data"
import { STEPS, useSetupWizard } from "./_hooks/use-setup-wizard"
import { useProfileStore } from "@/stores/profile-store"
import { SetupSteps } from "./_components/setup-steps"

const STEP_TITLES: Record<string, string> = {
  University: "دانشگاه خود را انتخاب کنید",
  Major: "رشته خود را انتخاب کنید",
  Degree: "مقطع تحصیلی",
  EntryYear: "سال ورود",
  Semester: "ترم ورود",
  Gender: "جنسیت",
  Term: "ترم فعلی (شماره ترم)",
  CurrentSemester: "نیم‌سال فعلی",
  IsLastTerm: "ترم آخر هستید؟",
}

export default function SetupPage() {
  const wizard = useSetupWizard()
  const { step, stepIndex, direction, saving, data, isLastStep, canGoForward, goBack, moveSteps, submit, submitMut } = wizard
  const [uniSearch, setUniSearch] = React.useState("")
  const [majorSearch, setMajorSearch] = React.useState("")

  const { unisQuery, universities, filteredUnis, visibleUnis, loadMoreUnis } = useUniversityData(uniSearch)
  const { majorsQuery, allMajors, filteredMajors, visibleMajors, loadMoreMajors } = useMajorData(data.university?.slug, majorSearch)
  const selectedMajor = useSelectedMajor(majorsQuery.data, data.majorSlug)
  const degrees = selectedMajor?.degrees ?? []
  const { yearDirsQuery, yearOptions } = useYearData(data.university?.slug, data.majorSlug, data.degree)
  const availableSemesters = useAvailableSemesters(yearDirsQuery.data, data.entryYearRange)

  // One-shot prefill from the SAVED profile so editing users start with their
  // current choices selected (and submit can never fail for an untouched
  // field). Two phases: university (needs the unis list), then the rest
  // (needs that university's majors). Skipped entirely for first-time setup,
  // and downstream fields are NOT prefilled when the user switched to a
  // different university — those must be freshly picked (gated steps).
  const profile = useProfileStore((s) => s.profile)
  const prefilledUniRef = React.useRef(false)
  const prefilledRestRef = React.useRef(false)

  React.useEffect(() => {
    if (prefilledUniRef.current || !wizard.isSetupComplete || !profile) return
    if (universities.length === 0) return
    prefilledUniRef.current = true
    const uni = universities.find((u) => u.slug === profile.universitySlug)
    if (uni) wizard.setData((prev) => ({ ...prev, university: prev.university ?? uni }))
  }, [universities, profile, wizard])

  React.useEffect(() => {
    if (prefilledRestRef.current || !prefilledUniRef.current || !wizard.isSetupComplete || !profile) return
    if (!data.university) return
    if (allMajors.length === 0 && majorsQuery.isLoading) return
    prefilledRestRef.current = true
    // User switched to a DIFFERENT university → downstream stays empty on
    // purpose; the gated steps make them re-pick everything fresh.
    if (data.university.slug !== profile.universitySlug) return
    const majorEntry = allMajors.find((m) => m.slug === profile.majorSlug)
    wizard.setData((prev) => ({
      ...prev,
      majorSlug: prev.majorSlug ?? majorEntry?.slug,
      majorName: prev.majorName ?? majorEntry?.name?.fa,
      degree: prev.degree ?? profile.degree ?? undefined,
      degreeName:
        prev.degreeName ??
        majorEntry?.degrees.find((d) => d.slug === profile.degree)?.name?.fa,
      entryYearRange: prev.entryYearRange ?? profile.entryYearRange ?? undefined,
      entrySemester: prev.entrySemester ?? profile.entrySemester ?? undefined,
      gender: prev.gender ?? profile.gender ?? undefined,
      termNumber: prev.termNumber ?? profile.termNumber ?? undefined,
      currentSemesterCode:
        prev.currentSemesterCode ?? profile.currentSemesterCode ?? undefined,
      isLastTerm: prev.isLastTerm ?? (profile.isLastTerm || undefined),
    }))
  }, [data.university, allMajors, majorsQuery.isLoading, profile, wizard])

  const wrappedMove = (delta: number) => {
    moveSteps(delta)
    setUniSearch("")
    setMajorSearch("")
  }

  const handleGoBack = () => {
    goBack()
    setUniSearch("")
    setMajorSearch("")
  }

  const handleGoForward = () => {
    if (!canGoForward() || isLastStep) return
    wrappedMove(1)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col overflow-x-clip px-4 safe-top-padding pb-4">
      <div className="flex items-center gap-3 py-4">
        <button
          onClick={handleGoBack}
          disabled={stepIndex === 0 && !wizard.isSetupComplete}
          className="rounded-lg border p-2 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          aria-label="بازگشت"
        >
          <ArrowRight className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">مرحله {stepIndex + 1} از {STEPS.length}</div>
          <h1 className="truncate text-base font-bold">{STEP_TITLES[step]}</h1>
        </div>
      </div>

      <div className="mb-6 h-1 overflow-hidden rounded-full bg-muted">
        {/* scaleX instead of width: compositor-only, no layout pass per frame.
            originX: 1 = fill grows from the inline-start edge (RTL). */}
        <m.div
          initial={false}
          className="h-full rounded-full bg-primary"
          style={{ originX: 1 }}
          animate={{ scaleX: stepIndex / STEPS.length }}
          transition={{ duration: 0.35 }}
        />
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <m.div
            key={step}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ transform: `translateX(${-110 * dir}%)`, opacity: 0 }),
              center: { transform: "translateX(0%)", opacity: 1 },
              exit: (dir: number) => ({ transform: `translateX(${110 * dir}%)`, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            <SetupSteps
              step={step}
              data={data}
              universities={universities}
              filteredUnis={filteredUnis}
              visibleUnis={visibleUnis}
              uniSearch={uniSearch}
              setUniSearch={setUniSearch}
              onSelectUniversity={(u) =>
                wizard.selectAndMaybeAdvance({
                  university: u,
                  majorSlug: undefined,
                  majorName: undefined,
                  degree: undefined,
                  degreeName: undefined,
                  entryYearRange: undefined,
                  entrySemester: undefined,
                })
              }
              onDoubleClickUniversity={(u) => {
                wizard.selectAndMaybeAdvance({ university: u })
                wrappedMove(1)
              }}
              onLoadMoreUnis={loadMoreUnis}
              unisLoading={unisQuery.isLoading}
              allMajors={allMajors}
              filteredMajors={filteredMajors}
              visibleMajors={visibleMajors}
              majorSearch={majorSearch}
              setMajorSearch={setMajorSearch}
              onSelectMajor={(m) =>
                wizard.selectAndMaybeAdvance({
                  majorSlug: m.slug,
                  majorName: m.name?.fa ?? m.slug,
                  degree: undefined,
                  degreeName: undefined,
                  entryYearRange: undefined,
                  entrySemester: undefined,
                })
              }
              onDoubleClickMajor={(m) => {
                wizard.selectAndMaybeAdvance({ majorSlug: m.slug, majorName: m.name?.fa ?? m.slug })
                wizard.advanceOnDoubleTap()
              }}
              onLoadMoreMajors={loadMoreMajors}
              majorsLoading={majorsQuery.isLoading}
              degrees={degrees}
              onSelectDegree={(slug, name) =>
                wizard.selectAndMaybeAdvance({ degree: slug, degreeName: name ?? slug, entryYearRange: undefined, entrySemester: undefined })
              }
              onDoubleClickDegree={(slug, name) => {
                wizard.selectAndMaybeAdvance({ degree: slug, degreeName: name ?? slug })
                wizard.advanceOnDoubleTap()
              }}
              yearOptions={yearOptions}
              onSelectYear={(range) => wizard.selectAndMaybeAdvance({ entryYearRange: range, entrySemester: undefined })}
              onDoubleClickYear={(range) => {
                wizard.selectAndMaybeAdvance({ entryYearRange: range })
                wizard.advanceOnDoubleTap()
              }}
              yearLoading={yearDirsQuery.isLoading}
              availableSemesters={availableSemesters}
              onSelectSemester={(v) => wizard.selectAndAdvance({ entrySemester: v })}
              onSelectGender={(v) => wizard.selectAndAdvance({ gender: v })}
              degreeForTerm={selectedMajor?.degrees.find((d) => d.slug === data.degree)}
              onSelectTerm={(n) => wizard.selectAndMaybeAdvance({ termNumber: n })}
              onDoubleClickTerm={(n) => wizard.selectAndAdvance({ termNumber: n })}
              currentSemesterTerms={wizard.currentSemesterTerms}
              selectedCurrentSemester={wizard.effectiveCurrentSemesterCode}
              onSelectCurrentSemester={(v) => wizard.selectAndMaybeAdvance({ currentSemesterCode: v })}
              onDoubleClickCurrentSemester={(v) => wizard.selectAndAdvance({ currentSemesterCode: v })}
              currentSemesterLoading={wizard.currentSemesterTermsQuery.isLoading}
              onSelectIsLastTerm={(v) => wizard.selectAndSubmit({ isLastTerm: v })}
            />
          </m.div>
        </AnimatePresence>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 safe-bottom-padding backdrop-blur-sm">
        <div className="mx-auto w-full max-w-screen-sm px-4 pt-3 pb-3">
          {submitMut.isError && <p className="pb-2 text-center text-xs text-destructive">{(submitMut.error as Error)?.message ?? "خطا"}</p>}
          <div className="flex justify-end">
            {isLastStep ? (
              <button
                onClick={submit}
                disabled={!canGoForward() || saving}
                aria-busy={saving}
                className="flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-md active:opacity-80 disabled:opacity-60"
              >
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                ذخیره و ادامه
              </button>
            ) : (
              <button
                onClick={handleGoForward}
                disabled={!canGoForward()}
                className="min-h-11 w-full touch-manipulation rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-md active:opacity-80 disabled:opacity-40"
              >
                بعدی
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="h-[calc(6rem+var(--tg-safe-area-inset-bottom,0px))]" aria-hidden />
    </div>
  )
}
