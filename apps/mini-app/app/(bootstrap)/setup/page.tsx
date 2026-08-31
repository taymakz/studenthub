"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { Virtuoso } from "react-virtuoso"
import { ArrowRight, Check, Loader2, Search } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"

import {
  fetchChartYearDirs,
  fetchMajors,
  fetchOfferingTerms,
  fetchUniversities,
  isProfileComplete,
  updateProfile,
  type MajorIndexEntry,
  type UniversityIndexEntry,
} from "@/lib/api"
import { matchesQuery } from "@/lib/search"
import { UniversityTypeIcon } from "@/components/app/university-type-icon"
import { NotFoundContribute } from "@/components/app/not-found-contribute"
import { getCurrentTerm } from "@/lib/term"
import { useProfileStore } from "@/stores/profile-store"

/** Infinite-scroll batch size for the virtualized uni/major lists. */
const LIST_PAGE_SIZE = 20

/**
 * 8-step profile wizard:
 *   University -> Major -> Degree -> EntryYear -> Semester -> Gender -> Term -> CurrentSemester
 * Term = ترم فعلی (شماره ترم 1..12) auto-detected from entry year + current Jalali date
 * CurrentSemester = نیم‌سال فعلی (e.g. 4051) auto-detected via Jalali month logic (6-8 MEHR, 9-12 BAHMAN, 2-5 SUMMER)
 */

const STEPS = [
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
type Step = (typeof STEPS)[number]

const STEP_TITLES: Record<Step, string> = {
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

const SEMESTER_LABEL = {
  MEHR: "مهر",
  BAHMAN: "بهمن",
  SUMMER: "تابستان",
} as const

interface WizardData {
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

/** Persian search row shown when a list step has more than 10 options. */
function ListSearch({
  value,
  onChange,
  resultCount,
}: {
  value: string
  onChange: (v: string) => void
  resultCount: number
}) {
  return (
    <InputGroup className="h-11 rounded-xl">
      <InputGroupInput
        placeholder="جستجو…"
        type="search"
        name="search"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        aria-label="جستجو"
        className="text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">{resultCount} نتیجه</InputGroupAddon>
    </InputGroup>
  )
}

/** Selectable row used by list steps - matches old card look. */
function OptionRow({
  title,
  subtitle,
  leading,
  selected,
  onClick,
  onDoubleClick,
}: {
  title: string
  subtitle?: string
  /** Optional icon tile (university type logo). */
  leading?: React.ReactNode
  selected: boolean
  onClick: () => void
  onDoubleClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-start transition-colors",
        selected ? "border-primary" : "hover:border-border/80"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        {leading && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted p-1.5 text-foreground">
            {leading}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{title}</span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
      </span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected && "border-primary bg-primary text-primary-foreground"
        )}
      >
        {selected && <Check className="size-3" />}
      </span>
    </button>
  )
}

/** Option grid for gender (cards) / semester & term (pills). */
function OptionGrid({
  options,
  value,
  onSelect,
  onCommit,
  onDoubleClick,
  columns = 2,
}: {
  options: Array<{ value: string; label: string }>
  value?: string
  onSelect: (v: string) => void
  onCommit?: (v: string) => void
  onDoubleClick?: (v: string) => void
  columns?: number
}) {
  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => {
            onSelect(opt.value)
            // Single-tap commit for card/pill steps (double-tap unnecessary)
            onCommit?.(opt.value)
          }}
          onDoubleClick={() => onDoubleClick?.(opt.value)}
          className={cn(
            "rounded-full border bg-card px-4 py-2.5 text-center text-sm tabular-nums transition-colors",
            value === opt.value ? "border-primary" : "hover:border-border/80"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = React.useState(0)
  /** +1 = going forward, -1 = going back — drives the swipe direction. */
  const [direction, setDirection] = React.useState(1)
  const [saving, setSaving] = React.useState(false)
  const step: Step = STEPS[stepIndex] ?? "University"
  const isLastStep = stepIndex === STEPS.length - 1

  const [data, setData] = React.useState<WizardData>({})

  const profile = useProfileStore((s) => s.profile)
  const isSetupComplete = isProfileComplete(profile ?? null)

  // Always start at first step when entering setup (fixes redirect from settings staying on last step)
  React.useEffect(() => {
    setStepIndex(0)
    setDirection(1)
  }, [])

  // ── List search (uni/major steps, only rendered past 10 options) ──
  const [uniSearch, setUniSearch] = React.useState("")
  const [majorSearch, setMajorSearch] = React.useState("")

  // Reset scroll so a shorter/longer step never leaves the page mid-scroll.
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })
  }, [stepIndex])

  // ── Registry queries (React Query cache) ──
  const unisQuery = useQuery({
    queryKey: ["universities"],
    queryFn: async () => (await fetchUniversities()).data.universities,
  })

  const majorsQuery = useQuery({
    queryKey: ["majors", data.university?.slug],
    queryFn: async () => (await fetchMajors(data.university!.slug)).data.majors,
    enabled: Boolean(data.university),
  })

  const selectedMajor: MajorIndexEntry | undefined = majorsQuery.data?.find(
    (m) => m.slug === data.majorSlug
  )
  const degrees = selectedMajor?.degrees ?? []

  // ── Option lists: multi-word fa/en/slug search over real registry data ──
  const universities = React.useMemo(
    () => unisQuery.data ?? [],
    [unisQuery.data]
  )
  const filteredUnis = React.useMemo(
    () =>
      universities.filter((u) =>
        matchesQuery(uniSearch, [u.name?.fa, u.location?.fa, u.slug])
      ),
    [universities, uniSearch]
  )
  // Infinite scroll: reveal LIST_PAGE_SIZE at a time; changing the query
  // resets pagination during render (React's adjust-state-on-prop-change
  // pattern - no effect, no cascading render).
  const [uniPage, setUniPage] = React.useState({
    query: uniSearch,
    count: LIST_PAGE_SIZE,
  })
  if (uniPage.query !== uniSearch) {
    setUniPage({ query: uniSearch, count: LIST_PAGE_SIZE })
  }
  const visibleUnis = React.useMemo(
    () => filteredUnis.slice(0, uniPage.count),
    [filteredUnis, uniPage.count]
  )

  const allMajors = React.useMemo(
    () => dedupeMajors(majorsQuery.data ?? []),
    [majorsQuery.data]
  )
  const filteredMajors = React.useMemo(
    () =>
      allMajors.filter((m) => matchesQuery(majorSearch, [m.name?.fa, m.slug])),
    [allMajors, majorSearch]
  )
  const [majorPage, setMajorPage] = React.useState({
    query: majorSearch,
    uni: data.university?.slug ?? "",
    count: LIST_PAGE_SIZE,
  })
  if (
    majorPage.query !== majorSearch ||
    majorPage.uni !== (data.university?.slug ?? "")
  ) {
    setMajorPage({
      query: majorSearch,
      uni: data.university?.slug ?? "",
      count: LIST_PAGE_SIZE,
    })
  }
  const visibleMajors = React.useMemo(
    () => filteredMajors.slice(0, majorPage.count),
    [filteredMajors, majorPage.count]
  )

  const yearDirsQuery = useQuery({
    queryKey: [
      "chart-year-dirs",
      data.university?.slug,
      data.majorSlug,
      data.degree,
    ],
    queryFn: async () => {
      const res = await fetchChartYearDirs(
        data.university!.slug,
        data.majorSlug!,
        data.degree!
      )
      // Dedup + sort newest first
      const seen = new Set<string>()
      const dirs: Array<{ dirName: string; semesters: string[] }> = []
      for (const c of res.data.charts) {
        if (!seen.has(c.yearDir)) {
          seen.add(c.yearDir)
          dirs.push({ dirName: c.yearDir, semesters: c.semesters })
        }
      }
      return dirs.sort((a, b) => b.dirName.localeCompare(a.dirName))
    },
    enabled:
      Boolean(data.university) &&
      Boolean(data.majorSlug) &&
      Boolean(data.degree),
  })

  const yearOptions = React.useMemo(() => {
    if (!yearDirsQuery.data) return []
    const out: Array<{ range: string; label: string }> = []
    for (const d of yearDirsQuery.data) {
      const match = /^\[(\d{4})-(\d{4})\]$/.exec(d.dirName)
      if (match) {
        out.push({ range: d.dirName, label: `${match[1]} تا ${match[2]}` })
      } else if (/^\d{4}$/.test(d.dirName)) {
        out.push({ range: d.dirName, label: d.dirName })
      }
    }
    return out
  }, [yearDirsQuery.data])

  const availableSemesters = React.useMemo(() => {
    const chosen = yearDirsQuery.data?.find(
      (d) => d.dirName === data.entryYearRange
    )
    if (!chosen) return [] as Array<"MEHR" | "BAHMAN" | "SUMMER">
    const sems = new Set<"MEHR" | "BAHMAN" | "SUMMER">()
    for (const s of chosen.semesters) {
      if (s === "MEHR" || s === "BAHMAN") {
        sems.add("MEHR")
        sems.add("BAHMAN")
      } else if (s === "SUMMER") {
        sems.add("SUMMER")
      }
    }
    return [...sems]
  }, [yearDirsQuery.data, data.entryYearRange])

  // ── Helpers for auto-detect (mirrors extension Jalali logic) ──
  const entryYearStart = (range?: string): number | null => {
    if (!range) return null
    const single = /^(\d{4})$/.exec(range)
    if (single) return Number(single[1])
    const pair = /^\[(\d{4})-(\d{4})\]$/.exec(range)
    if (pair) return Number(pair[1])
    return null
  }

  const calcAutoTermNumber = (): number | null => {
    const start = entryYearStart(data.entryYearRange)
    if (start == null || !data.entrySemester) return null
    const { year: curYear, month } = (() => {
      // Reuse getCurrentTerm's Jalali month logic but also need year
      const { year, month } = (() => {
        const fmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
          year: "numeric",
          month: "numeric",
          numberingSystem: "latn",
        })
        const parts = fmt.formatToParts(new Date())
        return {
          year: Number(parts.find((p) => p.type === "year")?.value ?? "1404"),
          month: Number(parts.find((p) => p.type === "month")?.value ?? "1"),
        }
      })()
      return { year, month }
    })()
    const { semester: curSem } = getCurrentTerm()
    const order: Record<string, number> = { MEHR: 0, BAHMAN: 1, SUMMER: 1 }
    const entryIdx = order[data.entrySemester] ?? 0
    const curIdx = order[curSem] ?? 0
    let n = (curYear - start) * 2 + (curIdx - entryIdx) + 1
    if (n < 1) n = 1
    if (n > 12) n = 12
    return n
  }

  // Offering terms for نیم‌سال step — same source as student-account
  const currentSemesterTermsQuery = useQuery({
    queryKey: [
      "offering-terms",
      data.university?.slug,
      data.majorSlug,
      "currentSemester",
    ],
    queryFn: async () =>
      (await fetchOfferingTerms(data.university!.slug, data.majorSlug!)).data
        .terms,
    enabled: Boolean(data.university && data.majorSlug),
  })
  const currentSemesterTerms = React.useMemo(
    () =>
      [...(currentSemesterTermsQuery.data ?? [])].sort((a, b) =>
        a.termCode.localeCompare(b.termCode)
      ),
    [currentSemesterTermsQuery.data]
  )

  // No auto-select for Term (ترم فعلی) — user must pick explicitly.
  // Auto-select highest term for CurrentSemester (نیم‌سال فعلی) when entering step.
  React.useEffect(() => {
    if (
      step === "CurrentSemester" &&
      !data.currentSemesterCode &&
      currentSemesterTerms.length > 0
    ) {
      const codes = currentSemesterTerms.map((t) => t.termCode)
      const preferred = [...codes].sort((a, b) => a.localeCompare(b)).at(-1)!
      setData((p) => ({ ...p, currentSemesterCode: preferred }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, currentSemesterTerms])

  // ── Step gating ──
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
        return true // optional — auto-detected if empty
      case "CurrentSemester":
        return true // optional — auto-detected if empty
      case "IsLastTerm":
        return true // optional — defaults to false
    }
    return false
  }

  const goBack = () => {
    if (stepIndex === 0) {
      if (isSetupComplete) router.replace("/profile")
      return
    }
    const prev: Step | undefined = STEPS[stepIndex - 1]
    if (!prev) return
    const prevIdx = STEPS.indexOf(prev)

    // Clear downstream selections when navigating back (same as old wizard)
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

  /** Move ±1 step. Forward moves require the CURRENT step to be filled, so
   * rapid double-taps can never land on the final step with missing fields
   * (which used to surface «لطفا همه گزینه‌ها را کامل کنید»). */
  const moveSteps = (delta: number) => {
    if (delta > 0 && !canGoForward()) return
    setDirection(delta < 0 ? -1 : 1)
    setStepIndex((i) => Math.min(Math.max(i + delta, 0), STEPS.length - 1))
    setUniSearch("")
    setMajorSearch("")
  }

  const goForward = () => {
    if (!canGoForward() || isLastStep) return
    moveSteps(1)
  }

  const submitMut = useMutation({
    mutationFn: async () => {
      if (
        !data.university ||
        !data.majorSlug ||
        !data.degree ||
        !data.entryYearRange ||
        !data.entrySemester ||
        !data.gender
      ) {
        throw new Error("لطفا همه گزینه‌ها را کامل کنید")
      }
      // Term (ترم فعلی) has no auto-default — only send if user picked.
      // CurrentSemester (نیم‌سال فعلی) defaults to highest available term if skipped.
      const termNumber = data.termNumber ?? undefined
      const currentSemesterCode =
        data.currentSemesterCode ??
        (() => {
          const codes = currentSemesterTerms.map((t) => t.termCode)
          if (codes.length === 0) return undefined
          return [...codes].sort((a, b) => a.localeCompare(b)).at(-1)
        })()
      return updateProfile({
        universitySlug: data.university.slug,
        majorSlug: data.majorSlug,
        degree: data.degree,
        entryYearRange: data.entryYearRange,
        entrySemester: data.entrySemester,
        gender: data.gender,
        ...(termNumber !== undefined ? { termNumber } : {}),
        ...(currentSemesterCode ? { currentSemesterCode } : {}),
        ...(data.isLastTerm !== undefined
          ? { isLastTerm: data.isLastTerm }
          : {}),
      })
    },
    onSuccess: async () => {
      await useProfileStore.getState().refresh()
      router.replace("/profile")
    },
  })

  const submit = () => {
    if (!canGoForward()) return
    setSaving(true)
    submitMut.mutate(undefined, {
      onSettled: () => setSaving(false),
    })
  }

  /** Single tap selects; double tap advances (old UX parity). */
  const selectAndMaybeAdvance = (patch: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...patch }))
  }

  const advanceOnDoubleTap = () => {
    if (isLastStep) submit()
    else moveSteps(1)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col overflow-x-clip px-4 safe-top-padding pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <button
          onClick={goBack}
          disabled={stepIndex === 0 && !isSetupComplete}
          className="rounded-lg border p-2 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          aria-label="بازگشت"
        >
          <ArrowRight className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">
            مرحله {stepIndex + 1} از {STEPS.length}
          </div>
          <h1 className="truncate text-base font-bold">{STEP_TITLES[step]}</h1>
        </div>
      </div>

      {/* Progress bar - 0 on the first step, fills as the wizard advances */}
      <div className="mb-6 h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={false}
          className="h-full rounded-full bg-primary"
          animate={{ width: `${(stepIndex / STEPS.length) * 100}%` }}
          transition={{ duration: 0.35 }}
        />
      </div>

      {/* Steps — directional swipe (multi-step pattern): forward slides right,
          back slides left, with opacity crossfading at the edges. custom on
          BOTH AnimatePresence and the child so the exiting step reads the
          latest direction (its props are stale mid-exit).
          popLayout pops the exiting step out with position:absolute — the
          wrapper below is `relative overflow-hidden` so (a) it is the
          containing block for that absolute element and (b) the ±110% slide
          is clipped here instead of leaking into the document's scrollable
          overflow (in RTL the -110% exit extends LEFT, which used to create
          a horizontal scrollbar and shift the whole layout). */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={{
              enter: (dir: number) => ({
                transform: `translateX(${-110 * dir}%)`,
                opacity: 0,
              }),
              center: { transform: "translateX(0%)", opacity: 1 },
              exit: (dir: number) => ({
                transform: `translateX(${110 * dir}%)`,
                opacity: 0,
              }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="will-change-transform"
          >
            {step === "University" && (
              <div className="space-y-2.5">
                {universities.length > 10 && (
                  <div className="pb-3">
                    <ListSearch
                      value={uniSearch}
                      onChange={setUniSearch}
                      resultCount={filteredUnis.length}
                    />
                  </div>
                )}
                {unisQuery.isLoading && universities.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    در حال بارگذاری…
                  </p>
                ) : filteredUnis.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    نتیجه‌ای یافت نشد.
                  </p>
                ) : (
                  /* Page scroll drives the virtualized list - no fixed-height wrapper */
                  <Virtuoso
                    useWindowScroll
                    data={visibleUnis}
                    computeItemKey={(_, u) => u.slug}
                    endReached={() =>
                      setUniPage((p) =>
                        p.count < filteredUnis.length
                          ? { ...p, count: p.count + LIST_PAGE_SIZE }
                          : p
                      )
                    }
                    itemContent={(_, u) => (
                      <div className="pb-2.5">
                        <OptionRow
                          title={u.name?.fa ?? u.slug}
                          subtitle={u.location?.fa}
                          leading={
                            <UniversityTypeIcon
                              type={u.type}
                              className="size-7"
                            />
                          }
                          selected={data.university?.slug === u.slug}
                          onClick={() =>
                            selectAndMaybeAdvance({
                              university: u,
                              majorSlug: undefined,
                              majorName: undefined,
                              degree: undefined,
                              degreeName: undefined,
                              entryYearRange: undefined,
                              entrySemester: undefined,
                            })
                          }
                          onDoubleClick={() => {
                            selectAndMaybeAdvance({ university: u })
                            moveSteps(1)
                          }}
                        />
                      </div>
                    )}
                  />
                )}
                <NotFoundContribute label="دانشگاه" />
              </div>
            )}

            {step === "Major" && (
              <div className="space-y-2.5">
                {allMajors.length > 10 && (
                  <div className="pb-3">
                    <ListSearch
                      value={majorSearch}
                      onChange={setMajorSearch}
                      resultCount={filteredMajors.length}
                    />
                  </div>
                )}
                {majorsQuery.isLoading && allMajors.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    در حال بارگذاری…
                  </p>
                ) : allMajors.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    رشته‌ای برای این دانشگاه ثبت نشده — دانشگاه دیگری را امتحان
                    کنید یا در گیت‌هاب مشارکت کنید.
                  </p>
                ) : filteredMajors.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    نتیجه‌ای یافت نشد.
                  </p>
                ) : (
                  /* Page scroll drives the virtualized list - no fixed-height wrapper */
                  <Virtuoso
                    useWindowScroll
                    data={visibleMajors}
                    computeItemKey={(_, m) => `${m.uniSlug}:${m.slug}`}
                    endReached={() =>
                      setMajorPage((p) =>
                        p.count < filteredMajors.length
                          ? { ...p, count: p.count + LIST_PAGE_SIZE }
                          : p
                      )
                    }
                    itemContent={(_, m) => (
                      <div className="pb-2.5">
                        <OptionRow
                          title={m.name?.fa ?? m.slug}
                          selected={data.majorSlug === m.slug}
                          onClick={() =>
                            selectAndMaybeAdvance({
                              majorSlug: m.slug,
                              majorName: m.name?.fa ?? m.slug,
                              degree: undefined,
                              degreeName: undefined,
                              entryYearRange: undefined,
                              entrySemester: undefined,
                            })
                          }
                          onDoubleClick={() => {
                            selectAndMaybeAdvance({
                              majorSlug: m.slug,
                              majorName: m.name?.fa ?? m.slug,
                            })
                            advanceOnDoubleTap()
                          }}
                        />
                      </div>
                    )}
                  />
                )}
                <NotFoundContribute label="رشته" />
              </div>
            )}

            {step === "Degree" && (
              <div className="space-y-2.5">
                {degrees.map((d) => (
                  <OptionRow
                    key={d.slug}
                    title={d.name?.fa ?? d.slug}
                    selected={data.degree === d.slug}
                    onClick={() =>
                      selectAndMaybeAdvance({
                        degree: d.slug,
                        degreeName: d.name?.fa ?? d.slug,
                        entryYearRange: undefined,
                        entrySemester: undefined,
                      })
                    }
                    onDoubleClick={() => {
                      selectAndMaybeAdvance({
                        degree: d.slug,
                        degreeName: d.name?.fa ?? d.slug,
                      })
                      advanceOnDoubleTap()
                    }}
                  />
                ))}
                <NotFoundContribute label="مقطع" />
              </div>
            )}

            {step === "EntryYear" && (
              <div className="space-y-2.5">
                {yearDirsQuery.isLoading ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    در حال بارگذاری…
                  </p>
                ) : yearOptions.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    چارتی برای این مقطع یافت نشد.
                  </p>
                ) : (
                  yearOptions.map((y) => (
                    <OptionRow
                      key={y.range}
                      title={y.label}
                      selected={data.entryYearRange === y.range}
                      onClick={() =>
                        selectAndMaybeAdvance({
                          entryYearRange: y.range,
                          entrySemester: undefined,
                        })
                      }
                      onDoubleClick={() => {
                        selectAndMaybeAdvance({ entryYearRange: y.range })
                        advanceOnDoubleTap()
                      }}
                    />
                  ))
                )}
                <NotFoundContribute label="سال ورود" />
              </div>
            )}

            {step === "Semester" && (
              <OptionGrid
                columns={2}
                options={availableSemesters.map((s) => ({
                  value: s,
                  label: SEMESTER_LABEL[s],
                }))}
                value={data.entrySemester}
                onSelect={(v) =>
                  selectAndMaybeAdvance({
                    entrySemester: v as typeof data.entrySemester,
                  })
                }
                onCommit={(v) => {
                  selectAndMaybeAdvance({
                    entrySemester: v as typeof data.entrySemester,
                  })
                  setTimeout(() => moveSteps(1), 120)
                }}
              />
            )}

            {step === "Gender" && (
              <OptionGrid
                columns={2}
                options={[
                  { value: "MALE", label: "پسر" },
                  { value: "FEMALE", label: "دختر" },
                ]}
                value={data.gender}
                onSelect={(v) =>
                  selectAndMaybeAdvance({ gender: v as "MALE" | "FEMALE" })
                }
                onCommit={(v) => {
                  selectAndMaybeAdvance({ gender: v as "MALE" | "FEMALE" })
                  setTimeout(() => moveSteps(1), 120)
                }}
              />
            )}

            {step === "Term" &&
              (() => {
                const degree = selectedMajor?.degrees.find(
                  (d) => d.slug === data.degree
                )
                const degreeTermCount = degree?.termCount ?? 8
                const maxTerm = degree?.maxTermCount ?? 12
                const normal = Array.from(
                  { length: degreeTermCount },
                  (_, i) => degreeTermCount - i
                )
                const extended =
                  maxTerm > degreeTermCount
                    ? Array.from(
                        { length: maxTerm - degreeTermCount },
                        (_, i) => maxTerm - i
                      )
                    : []
                return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="px-1 text-xs font-medium text-muted-foreground">
                        ترم‌های اصلی (۱ تا {degreeTermCount})
                      </p>
                      <OptionGrid
                        columns={4}
                        options={normal.map((n) => ({
                          value: String(n),
                          label: String(n),
                        }))}
                        value={
                          data.termNumber !== undefined
                            ? String(data.termNumber)
                            : undefined
                        }
                        onSelect={(v) =>
                          selectAndMaybeAdvance({ termNumber: Number(v) })
                        }
                        onDoubleClick={(v) => {
                          selectAndMaybeAdvance({ termNumber: Number(v) })
                          setTimeout(() => moveSteps(1), 120)
                        }}
                      />
                    </div>
                    {extended.length > 0 && (
                      <div className="space-y-2">
                        <p className="px-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          سنوات مجاز ({degreeTermCount + 1} تا {maxTerm})
                        </p>
                        <div
                          className="grid gap-2.5"
                          style={{
                            gridTemplateColumns: `repeat(4, minmax(0,1fr))`,
                          }}
                        >
                          {extended.map((n) => {
                            const selected = data.termNumber === n
                            return (
                              <button
                                key={n}
                                onClick={() =>
                                  selectAndMaybeAdvance({ termNumber: n })
                                }
                                onDoubleClick={() => {
                                  selectAndMaybeAdvance({ termNumber: n })
                                  setTimeout(() => moveSteps(1), 120)
                                }}
                                className={cn(
                                  "rounded-full border bg-card px-4 py-2.5 text-center text-sm tabular-nums transition-colors",
                                  selected
                                    ? "border-amber-500 bg-amber-500 text-white"
                                    : "border-amber-200 hover:border-amber-300 dark:border-amber-900/50"
                                )}
                              >
                                {n}
                              </button>
                            )
                          })}
                        </div>
                        <p className="px-1 text-[11px] leading-4 text-muted-foreground">
                          کارشناسی پیوسته نهایت {degreeTermCount} ترمه؛{" "}
                          {degreeTermCount + 1} تا {maxTerm} سنوات محسوب می‌شود
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()}

            {step === "CurrentSemester" && (
              <div className="space-y-2.5">
                {currentSemesterTermsQuery.isLoading ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    در حال بارگذاری…
                  </p>
                ) : currentSemesterTerms.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    نیم‌سالی برای این رشته یافت نشد — بعداً در تنظیمات می‌توانید
                    انتخاب کنید.
                  </p>
                ) : (
                  <OptionGrid
                    columns={2}
                    options={[...currentSemesterTerms]
                      .sort((a, b) => b.termCode.localeCompare(a.termCode))
                      .map((t) => ({
                        value: t.termCode,
                        label: `${t.termCode} ${SEMESTER_LABEL[t.semester as keyof typeof SEMESTER_LABEL]}`,
                      }))}
                    value={data.currentSemesterCode}
                    onSelect={(v) =>
                      selectAndMaybeAdvance({ currentSemesterCode: v })
                    }
                    onDoubleClick={(v) => {
                      selectAndMaybeAdvance({ currentSemesterCode: v })
                      setTimeout(() => moveSteps(1), 120)
                    }}
                  />
                )}
                <NotFoundContribute label="نیم‌سال" />
              </div>
            )}

            {step === "IsLastTerm" && (
              <OptionGrid
                columns={2}
                options={[
                  { value: "true", label: "بله" },
                  { value: "false", label: "خیر" },
                ]}
                value={
                  data.isLastTerm !== undefined
                    ? String(data.isLastTerm)
                    : undefined
                }
                onSelect={(v) =>
                  selectAndMaybeAdvance({ isLastTerm: v === "true" })
                }
                onCommit={(v) => {
                  selectAndMaybeAdvance({ isLastTerm: v === "true" })
                  setTimeout(() => submit(), 120)
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer actions - pinned to the bottom of the viewport while the
          step content scrolls under it. Primary action sits on the visual
          left (RTL end). */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 safe-bottom-padding backdrop-blur-sm">
        <div className="mx-auto w-full max-w-screen-sm px-4 pt-3 pb-3">
          {submitMut.isError && (
            <p className="pb-2 text-center text-xs text-destructive">
              {(submitMut.error as Error)?.message ?? "خطا"}
            </p>
          )}
          <div className="flex justify-end">
            {isLastStep ? (
              <button
                onClick={submit}
                disabled={!canGoForward() || saving}
                aria-busy={saving}
                className="flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-md active:opacity-80 disabled:opacity-60"
              >
                {saving && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                ذخیره و ادامه
              </button>
            ) : (
              <button
                onClick={goForward}
                disabled={!canGoForward()}
                className="min-h-11 w-full touch-manipulation rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-md active:opacity-80 disabled:opacity-40"
              >
                بعدی
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Spacer matching the fixed bar height (button + padding + TG bottom
          safe inset) so it never covers the last list items */}
      <div
        className="h-[calc(6rem+var(--tg-safe-area-inset-bottom,0px))]"
        aria-hidden
      />
    </div>
  )
}

/** Shared-slug dedup (مهندسی کامپیوتر exists in several universities). */
function dedupeMajors(majors: MajorIndexEntry[]): MajorIndexEntry[] {
  const bySlug = new Map<string, MajorIndexEntry>()
  for (const m of majors) if (!bySlug.has(m.slug)) bySlug.set(m.slug, m)
  return [...bySlug.values()]
}
