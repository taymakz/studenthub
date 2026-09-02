"use client"

import * as React from "react"

import { create } from "zustand"

import type {
  ChartCourse,
  ChartState,
  ElectiveGroup,
  Semester,
} from "@/lib/chart"
import { defaultChartState, slugify } from "@/lib/chart"
import type { PoolCourse } from "@/lib/pool"
import { poolToChartCourse } from "@/lib/pool"
import type { BuilderScope } from "@/lib/scope"
import { defaultScope } from "@/lib/scope"
import { scopedKey, useProfileStore } from "@/components/profile-store"

/**
 * Global builder state (pool / chart / scope) as one zustand store plus
 * per-profile localStorage persistence. Buckets are keyed "<base>:<profileId>"
 * and swapped whenever the active profile changes (see ChartStoreSync).
 */

/* ==========================================================================
   Store shape
   ========================================================================== */

/** The imported course pool plus how many raw offerings it came from. */
export interface PoolState {
  courses: PoolCourse[]
  totalOfferings: number
}

interface ChartStore {
  pool: PoolState
  setPool: React.Dispatch<React.SetStateAction<PoolState>>

  chart: ChartState
  setChart: React.Dispatch<React.SetStateAction<ChartState>>
  resetChart: () => void
  /** Empties every course content but keeps degree/termCount meta. */
  clearCourses: () => void

  setDegree: (degree: string) => void
  setTermCount: (termCount: number) => void
  setIsCompleted: (isCompleted: boolean) => void
  /** Shrinks the count AND permanently drops every term beyond it in one
      update - removed courses never persist. */
  shrinkTermCount: (termCount: number) => void
  /** Replaces the whole terms map with an imported doc's terms and grows
      termCount so every imported term is visible. */
  importTermsDoc: (terms: Record<number, ChartCourse[]>) => void
  /** Replaces the moaref list with an imported doc's moaref. */
  importMoarefDoc: (courses: ChartCourse[]) => void
  addCourseToTerm: (term: number, course: ChartCourse) => void
  addCoursesToTerm: (term: number, courses: ChartCourse[]) => void
  removeCourseFromTerm: (term: number, index: number) => void
  removeCoursesFromTerm: (term: number, names: string[]) => void
  setRequisites: (
    term: number,
    index: number,
    kind: "prerequisites" | "corequisites",
    values: string[] | number | { term: number }
  ) => void
  addMoaref: (course: ChartCourse) => void
  addMoarefMany: (courses: ChartCourse[]) => void
  removeMoaref: (index: number) => void
  removeMoarefMany: (names: string[]) => void
  setMoarefRequisites: (
    index: number,
    kind: "prerequisites" | "corequisites",
    values: string[] | number | { term: number }
  ) => void
  addUnknown: (course: ChartCourse) => void
  addUnknownMany: (courses: ChartCourse[]) => void
  removeUnknown: (index: number) => void
  removeUnknownMany: (names: string[]) => void
  moveMoarefToUnknown: (index: number) => void
  moveUnknownToMoaref: (index: number) => void
  /** Re-syncs unknown = pool courses not used in moaref/terms/electives. */
  syncAllUnknown: (pool: PoolCourse[]) => void
  addElectiveGroup: (group: Omit<ElectiveGroup, "slug">) => void
  updateElectiveGroup: (slug: string, patch: Partial<ElectiveGroup>) => void
  removeElectiveGroup: (slug: string) => void

  scope: BuilderScope
  setMode: (mode: BuilderScope["mode"]) => void
  toggleSemester: (semester: Semester) => void
  toggleYear: (year: number) => void
}

/* ==========================================================================
   Zustand store
   ========================================================================== */

export const useChartStore = create<ChartStore>()((set) => ({
  pool: { courses: [], totalOfferings: 0 },
  setPool: (action) =>
    set((s) => ({
      pool:
        typeof action === "function"
          ? (action as (p: PoolState) => PoolState)(s.pool)
          : action,
    })),

  chart: defaultChartState(),
  setChart: (action) =>
    set((s) => ({
      chart:
        typeof action === "function"
          ? (action as (c: ChartState) => ChartState)(s.chart)
          : action,
    })),

  /* --- Meta: reset / clear / degree / term count / imports --- */

  resetChart: () => set({ chart: defaultChartState() }),

  clearCourses: () =>
    set((s) => ({
      chart: {
        ...s.chart,
        terms: {},
        moaref: [],
        unknown: [],
        electives: [],
      },
    })),

  setDegree: (degree) => set((s) => ({ chart: { ...s.chart, degree } })),

  setTermCount: (termCount) =>
    set((s) => ({ chart: { ...s.chart, termCount } })),

  setIsCompleted: (isCompleted) =>
    set((s) => ({ chart: { ...s.chart, isCompleted } })),

  shrinkTermCount: (termCount) =>
    set((s) => {
      const terms: Record<number, ChartCourse[]> = {}
      for (const [key, courses] of Object.entries(s.chart.terms)) {
        if (Number(key) <= termCount) terms[Number(key)] = courses
      }
      return { chart: { ...s.chart, termCount, terms } }
    }),

  importTermsDoc: (terms) =>
    set((s) => {
      const maxKey = Math.max(0, ...Object.keys(terms).map(Number))
      return {
        chart: {
          ...s.chart,
          terms,
          termCount: Math.max(s.chart.termCount, maxKey),
        },
      }
    }),

  importMoarefDoc: (courses) =>
    set((s) => ({ chart: { ...s.chart, moaref: courses } })),

  /* --- Term courses --- */

  addCourseToTerm: (term, course) =>
    set((s) => ({
      chart: {
        ...s.chart,
        terms: {
          ...s.chart.terms,
          [term]: [...(s.chart.terms[term] ?? []), course],
        },
      },
    })),

  addCoursesToTerm: (term, courses) =>
    set((s) => {
      const existing = new Set((s.chart.terms[term] ?? []).map((c) => c.name))
      const fresh = courses.filter((c) => !existing.has(c.name))
      if (fresh.length === 0) return s
      return {
        chart: {
          ...s.chart,
          terms: {
            ...s.chart.terms,
            [term]: [...(s.chart.terms[term] ?? []), ...fresh],
          },
        },
      }
    }),

  removeCourseFromTerm: (term, index) =>
    set((s) => ({
      chart: {
        ...s.chart,
        terms: {
          ...s.chart.terms,
          [term]: (s.chart.terms[term] ?? []).filter((_, i) => i !== index),
        },
      },
    })),

  removeCoursesFromTerm: (term, names) =>
    set((s) => {
      const doomed = new Set(names)
      return {
        chart: {
          ...s.chart,
          terms: {
            ...s.chart.terms,
            [term]: (s.chart.terms[term] ?? []).filter(
              (c) => !doomed.has(c.name)
            ),
          },
        },
      }
    }),

  setRequisites: (term, index, kind, values) =>
    set((s) => ({
      chart: {
        ...s.chart,
        terms: {
          ...s.chart.terms,
          [term]: (s.chart.terms[term] ?? []).map((course, i) =>
            i === index ? { ...course, [kind]: values } : course
          ),
        },
      },
    })),

  /* --- معارف --- */

  addMoaref: (course) =>
    set((s) => ({
      chart: { ...s.chart, moaref: [...s.chart.moaref, course] },
    })),

  addMoarefMany: (courses) =>
    set((s) => {
      const existing = new Set(s.chart.moaref.map((c) => c.name))
      const fresh = courses.filter((c) => !existing.has(c.name))
      return {
        chart: { ...s.chart, moaref: [...s.chart.moaref, ...fresh] },
      }
    }),

  setMoarefRequisites: (index, kind, values) =>
    set((s) => ({
      chart: {
        ...s.chart,
        moaref: s.chart.moaref.map((course, i) =>
          i === index ? { ...course, [kind]: values } : course
        ),
      },
    })),

  removeMoaref: (index) =>
    set((s) => ({
      chart: {
        ...s.chart,
        moaref: s.chart.moaref.filter((_, i) => i !== index),
      },
    })),

  removeMoarefMany: (names) => {
    set((s) => {
      const doomed = new Set(names)
      return {
        chart: {
          ...s.chart,
          moaref: s.chart.moaref.filter((c) => !doomed.has(c.name)),
        },
      }
    })
  },

  moveMoarefToUnknown: (index) =>
    set((s) => {
      const course = s.chart.moaref[index]
      if (!course) return s
      return {
        chart: {
          ...s.chart,
          moaref: s.chart.moaref.filter((_, i) => i !== index),
          unknown: [...s.chart.unknown, course],
        },
      }
    }),

  moveUnknownToMoaref: (index) =>
    set((s) => {
      const course = s.chart.unknown[index]
      if (!course) return s
      return {
        chart: {
          ...s.chart,
          unknown: s.chart.unknown.filter((_, i) => i !== index),
          moaref: [...s.chart.moaref, course],
        },
      }
    }),

  syncAllUnknown: (pool) =>
    set((s) => {
      // Used anywhere EXCEPT unknown: those are exactly the courses the
      // unknown bucket should hold afterwards.
      const used = new Set<string>()
      s.chart.moaref.forEach((c) => used.add(c.name))
      for (const courses of Object.values(s.chart.terms)) {
        courses.forEach((c) => used.add(c.name))
      }
      for (const group of s.chart.electives) {
        group.courses.forEach((c) => used.add(c.name))
      }
      const seen = new Set<string>()
      const next: ChartCourse[] = []
      for (const course of pool) {
        const chartCourse = poolToChartCourse(course)
        if (used.has(chartCourse.name) || seen.has(chartCourse.name)) {
          continue
        }
        seen.add(chartCourse.name)
        next.push(chartCourse)
      }
      return { chart: { ...s.chart, unknown: next } }
    }),

  /* --- Unknown bucket --- */

  addUnknown: (course) =>
    set((s) => ({
      chart: { ...s.chart, unknown: [...s.chart.unknown, course] },
    })),

  addUnknownMany: (courses) =>
    set((s) => {
      const existing = new Set(s.chart.unknown.map((c) => c.name))
      const fresh = courses.filter((c) => !existing.has(c.name))
      return {
        chart: { ...s.chart, unknown: [...s.chart.unknown, ...fresh] },
      }
    }),

  removeUnknown: (index) =>
    set((s) => ({
      chart: {
        ...s.chart,
        unknown: s.chart.unknown.filter((_, i) => i !== index),
      },
    })),

  removeUnknownMany: (names) => {
    set((s) => {
      const doomed = new Set(names)
      return {
        chart: {
          ...s.chart,
          unknown: s.chart.unknown.filter((c) => !doomed.has(c.name)),
        },
      }
    })
  },

  /* --- Elective groups (advanced mode) --- */

  addElectiveGroup: (group) =>
    set((s) => {
      const slug = slugify(
        group.title,
        s.chart.electives.map((g) => g.slug)
      )
      return {
        chart: {
          ...s.chart,
          electives: [...s.chart.electives, { ...group, slug }],
        },
      }
    }),

  updateElectiveGroup: (slug, patch) =>
    set((s) => ({
      chart: {
        ...s.chart,
        electives: s.chart.electives.map((g) =>
          g.slug === slug ? { ...g, ...patch } : g
        ),
      },
    })),

  removeElectiveGroup: (slug) =>
    set((s) => ({
      chart: {
        ...s.chart,
        electives: s.chart.electives.filter((g) => g.slug !== slug),
      },
    })),

  /* --- Scope: entry year / semester --- */

  scope: defaultScope(),

  setMode: (mode) => set((s) => ({ scope: { ...s.scope, mode } })),

  toggleSemester: (semester) =>
    set((s) => ({
      scope: {
        ...s.scope,
        semesters: s.scope.semesters.includes(semester)
          ? // Never allow an empty selection - fall back to just this one.
            s.scope.semesters.length > 1
            ? s.scope.semesters.filter((x) => x !== semester)
            : s.scope.semesters
          : [...s.scope.semesters, semester].sort(
              (a, b) =>
                ["MEHR", "BAHMAN", "SUMMER"].indexOf(a) -
                ["MEHR", "BAHMAN", "SUMMER"].indexOf(b)
            ),
      },
    })),

  toggleYear: (year) =>
    set((s) => ({
      scope: {
        ...s.scope,
        years: s.scope.years.includes(year)
          ? // Never allow an empty selection.
            s.scope.years.length > 1
            ? s.scope.years.filter((y) => y !== year)
            : s.scope.years
          : [...s.scope.years, year].sort((a, b) => a - b),
      },
    })),
}))

/* ==========================================================================
   Legacy storage upgrade (pre-profile builds)
   ========================================================================== */

let legacyStorageMigrated = false

/** One-time upgrade: builds saved before profiles existed lived under bare
    sb-* keys; seed them into the then-active profile's buckets so existing
    work survives, then drop the un-scoped originals. */
function migrateLegacyStorage(profileId: string) {
  if (legacyStorageMigrated || typeof window === "undefined") return
  legacyStorageMigrated = true
  try {
    for (const base of ["sb-pool", "sb-chart", "sb-scope"]) {
      const legacyRaw = window.localStorage.getItem(base)
      if (legacyRaw == null) continue
      const target = scopedKey(base, profileId)
      if (window.localStorage.getItem(target) == null) {
        window.localStorage.setItem(target, legacyRaw)
      }
      window.localStorage.removeItem(base)
    }
  } catch {
    // storage blocked - in-memory defaults still work
  }
}

/* ==========================================================================
   Per-profile bucket persistence
   ========================================================================== */

// The profile store hydrates synchronously from localStorage during its own
// module init, so this is already correct before any component renders.
let currentProfileId = useProfileStore.getState().activeId ?? "default"

// True while a profile's buckets are being loaded into the store - those
// writes must not be echoed back under the (newly active) key.
let loadingBuckets = false

function writeBuckets(state: ChartStore): void {
  if (typeof window === "undefined" || loadingBuckets) return
  try {
    window.localStorage.setItem(
      scopedKey("sb-pool", currentProfileId),
      JSON.stringify(state.pool)
    )
    window.localStorage.setItem(
      scopedKey("sb-chart", currentProfileId),
      JSON.stringify(state.chart)
    )
    window.localStorage.setItem(
      scopedKey("sb-scope", currentProfileId),
      JSON.stringify(state.scope)
    )
  } catch {
    // storage full/blocked - state still works in-memory
  }
}

// Every mutation persists immediately; no debouncing, matching the old
// write-through behavior.
useChartStore.subscribe(writeBuckets)

function dedupeChartState(chart: ChartState): ChartState {
  // Keep first occurrence of each course name in every bucket.
  const dedupeList = (list: ChartCourse[]) => {
    const seen = new Set<string>()
    const out: ChartCourse[] = []
    for (const c of list) {
      if (seen.has(c.name)) continue
      seen.add(c.name)
      out.push(c)
    }
    return out
  }
  const globalSeen = new Set<string>()
  const dedupedTerms: Record<number, ChartCourse[]> = {}
  for (const [k, list] of Object.entries(chart.terms)) {
    const term = Number(k)
    const filtered: ChartCourse[] = []
    for (const c of list) {
      if (globalSeen.has(c.name)) continue
      // Also dedupe within term (defensive).
      if (filtered.some((x) => x.name === c.name)) continue
      globalSeen.add(c.name)
      filtered.push(c)
    }
    dedupedTerms[term] = filtered
  }
  // Moaref may contain names already in terms — keep only new.
  const moaref: ChartCourse[] = []
  for (const c of chart.moaref) {
    if (globalSeen.has(c.name) || moaref.some((x) => x.name === c.name))
      continue
    globalSeen.add(c.name)
    moaref.push(c)
  }
  // Unknown is what’s left — dedupe and exclude already placed.
  const unknown = dedupeList(
    chart.unknown.filter((c) => !globalSeen.has(c.name))
  )
  // Elective groups: dedupe each group internally.
  const electives = chart.electives.map((g) => ({
    ...g,
    courses: dedupeList(g.courses),
  }))

  // If any bucket changed length, return new object; otherwise keep identity.
  const changed =
    Object.keys(dedupedTerms).length !== Object.keys(chart.terms).length ||
    Object.values(dedupedTerms).some(
      (v, i) => v.length !== Object.values(chart.terms)[i]?.length
    ) ||
    moaref.length !== chart.moaref.length ||
    unknown.length !== chart.unknown.length
  if (!changed) {
    // Still ensure moaref/unknown were deduped even if terms same.
    if (
      moaref.length === chart.moaref.length &&
      unknown.length === chart.unknown.length &&
      electives.length === chart.electives.length
    )
      return chart
  }
  return { ...chart, terms: dedupedTerms, moaref, unknown, electives }
}

function readBucket<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Loads a profile's three buckets into the store; missing or corrupt data
    falls back to fresh defaults, never the previous profile's state. */
function loadProfileBuckets(profileId: string): void {
  if (typeof window === "undefined") return
  migrateLegacyStorage(profileId)

  let pool = readBucket<PoolState>(scopedKey("sb-pool", profileId))
  // Migrates the old plain-array pool shape to { courses, totalOfferings }.
  if (Array.isArray(pool)) {
    pool = { courses: pool, totalOfferings: pool.length }
  }

  loadingBuckets = true
  try {
    const storedChart = readBucket<ChartState>(scopedKey("sb-chart", profileId))
    let chart = storedChart ?? defaultChartState()
    // Normalize isCompleted for charts saved before the field existed — default checked
    if (
      (chart as unknown as { isCompleted?: boolean }).isCompleted === undefined
    )
      chart.isCompleted = true
    // Deduplicate persisted chart that was saved before the name-dedup fix:
    // multiple “پایان نامه” entries with same name would cause React duplicate
    // keys and inflated counts (profile 155 vs courses 125). Keep first per name.
    chart = dedupeChartState(chart)
    useChartStore.setState({
      pool: pool ?? { courses: [], totalOfferings: 0 },
      chart,
      scope:
        readBucket<BuilderScope>(scopedKey("sb-scope", profileId)) ??
        defaultScope(),
    })
  } finally {
    loadingBuckets = false
  }
}

/** Mount-once bridge between the profile store and the working-state
    buckets: every switch remaps the storage keys and reloads the store. */
export function ChartStoreSync(): null {
  const activeId = useProfileStore((s) => s.activeId)

  React.useEffect(() => {
    currentProfileId = activeId ?? "default"
    loadProfileBuckets(currentProfileId)
  }, [activeId])

  return null
}
