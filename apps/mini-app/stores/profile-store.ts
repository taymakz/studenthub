"use client"

import { create } from "zustand"

import {
  addNoted,
  fetchMe,
  removeFailedCourse,
  removeNoted,
  removePassedCourse,
  replaceFailedCourses,
  replacePassedCourses,
  type MeFailed,
  type MeNoted,
  type MePassed,
  type MeProfile,
  type MeResponse,
  type MeUser,
  type MyChart,
  type Offering,
  type OfferingTerm,
} from "@/lib/api"
import { apiClient, ApiError } from "@/lib/request"
import { parseTermCode } from "@/lib/term"
import { toastManager } from "@workspace/ui/components/toast"

/**
 * App-wide profile data store - one `/me/bootstrap` request hydrates user,
 * profile, passed/failed/noted, the graduation chart, current offering terms
 * and the current نیم سال offerings+diff. Other pages read from here (and the
 * calc helpers in lib/course-calc) instead of fanning out many requests.
 */
interface ProfileStore {
  user: MeUser | null
  profile: MeProfile | null
  passed: MePassed[]
  failed: MeFailed[]
  noted: MeNoted[]
  chart: MyChart | null
  offerings: Offering[]
  terms: OfferingTerm[]
  termCode: string | null
  changes: MeResponse["changes"]
  loading: boolean
  error: boolean
  hydrated: boolean
  maintenance: boolean
  maintenanceReason: string | null
  maintenanceCanBypass: boolean
  banned: boolean
  bannedReason: string | null

  hydrate: () => Promise<void>
  refresh: () => Promise<void>
  setSemester: (code: string) => Promise<void>
  setPassed: (names: string[]) => void
  setFailed: (names: string[]) => void
  toggleNote: (courseIndex: string) => void
  togglePassed: (courseName: string) => void
  toggleFailed: (courseName: string) => void
  clearNoted: () => void
}

function applyData(set: (p: Partial<ProfileStore>) => void, d: MeResponse) {
  set({
    user: d.user,
    profile: d.profile,
    passed: d.passed,
    failed: d.failed,
    noted: d.noted,
    chart: d.chart,
    offerings: d.offerings,
    terms: d.terms,
    termCode: d.term?.termCode ?? null,
    changes: d.changes,
  })
}

// ── Singleton guard — guarantees /me/bootstrap fires exactly once per page
// load even under React StrictMode double-mount or concurrent callers. The
// promise is shared, never re-created until settled and hydrated=true.
let hydratePromise: Promise<void> | null = null

export const useProfileStore = create<ProfileStore>((set, get) => ({
  user: null,
  profile: null,
  passed: [],
  failed: [],
  noted: [],
  chart: null,
  offerings: [],
  terms: [],
  termCode: null,
  changes: null,
  loading: false,
  error: false,
  hydrated: false,
  maintenance: false,
  maintenanceReason: null,
  maintenanceCanBypass: false,
  banned: false,
  bannedReason: null,

  hydrate: async () => {
    if (get().hydrated) return
    if (hydratePromise) return hydratePromise
    set({ loading: true })
    hydratePromise = (async () => {
      try {
        // Timeout: if the API call hangs, resolve as error so the user
        // sees the retry screen instead of being stuck on the splash.
        const d = await Promise.race([
          fetchMe(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("hydrate timeout")), 10_000)
          ),
        ]).then((r) => (r as Awaited<ReturnType<typeof fetchMe>>).data)
        // Banned — short-circuit before maintenance (banned takes precedence)
        if ((d as unknown as { banned?: boolean }).banned) {
          const bd = d as unknown as { bannedReason?: string | null }
          set({
            loading: false,
            error: false,
            hydrated: true,
            banned: true,
            bannedReason: bd?.bannedReason ?? null,
            maintenance: false,
            maintenanceReason: null,
            maintenanceCanBypass: false,
          })
          try {
            if (bd?.bannedReason)
              sessionStorage.setItem("sh_banned_reason", bd.bannedReason)
            else sessionStorage.removeItem("sh_banned_reason")
          } catch {}
          return
        }
        // Maintenance mode — short-circuit
        if (d.maintenance) {
          set({
            loading: false,
            error: false,
            hydrated: true,
            maintenance: true,
            maintenanceReason: d.maintenanceReason ?? null,
            maintenanceCanBypass: Boolean(
              (d as unknown as { canBypass?: boolean }).canBypass
            ),
            banned: false,
            bannedReason: null,
          })
          return
        }
        applyData(set, d)
        set({
          loading: false,
          error: false,
          hydrated: true,
          maintenance: false,
          maintenanceReason: null,
          maintenanceCanBypass: false,
          banned: false,
          bannedReason: null,
        })
      } catch (e) {
        // 403 banned gate
        if (
          e instanceof ApiError &&
          e.status === 403 &&
          (e.data as unknown as { banned?: boolean })?.banned
        ) {
          const data = e.data as unknown as { bannedReason?: string | null }
          set({
            loading: false,
            error: false,
            hydrated: true,
            banned: true,
            bannedReason: data?.bannedReason ?? null,
            maintenance: false,
            maintenanceReason: null,
            maintenanceCanBypass: false,
          })
          try {
            if (data?.bannedReason)
              sessionStorage.setItem("sh_banned_reason", data.bannedReason)
            else sessionStorage.removeItem("sh_banned_reason")
          } catch {}
          return
        }
        // 503 maintenance gate returns data in the error
        if (
          e instanceof ApiError &&
          e.status === 503 &&
          (e.data as unknown as { maintenance?: boolean })?.maintenance
        ) {
          const data = e.data as unknown as {
            maintenanceReason?: string | null
            canBypass?: boolean
          }
          set({
            loading: false,
            error: false,
            hydrated: true,
            maintenance: true,
            maintenanceReason: data?.maintenanceReason ?? null,
            maintenanceCanBypass: Boolean(data?.canBypass),
            banned: false,
            bannedReason: null,
          })
          return
        }
        set({ loading: false, error: true, hydrated: true })
      } finally {
        // Keep promise resolved so future callers hit the hydrated guard;
        // do not null it — hydrate must never re-fire automatically.
      }
    })()
    return hydratePromise
  },

  refresh: async () => {
    set({ loading: true })
    try {
      const d = await Promise.race([
        fetchMe(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("refresh timeout")), 10_000)
        ),
      ]).then((r) => (r as Awaited<ReturnType<typeof fetchMe>>).data)
      if ((d as unknown as { banned?: boolean }).banned) {
        const bd = d as unknown as { bannedReason?: string | null }
        set({
          loading: false,
          error: false,
          hydrated: true,
          banned: true,
          bannedReason: bd?.bannedReason ?? null,
          maintenance: false,
          maintenanceReason: null,
          maintenanceCanBypass: false,
        })
        try {
          if (bd?.bannedReason)
            sessionStorage.setItem("sh_banned_reason", bd.bannedReason)
          else sessionStorage.removeItem("sh_banned_reason")
        } catch {}
        return
      }
      if ((d as unknown as { maintenance?: boolean }).maintenance) {
        set({
          loading: false,
          error: false,
          hydrated: true,
          maintenance: true,
          maintenanceReason:
            (d as unknown as { maintenanceReason?: string | null })
              .maintenanceReason ?? null,
          maintenanceCanBypass: Boolean(
            (d as unknown as { canBypass?: boolean }).canBypass
          ),
          banned: false,
          bannedReason: null,
        })
        return
      }
      applyData(set, d)
      set({
        loading: false,
        error: false,
        hydrated: true,
        maintenance: false,
        maintenanceReason: null,
        maintenanceCanBypass: false,
        banned: false,
        bannedReason: null,
      })
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 403 &&
        (e.data as unknown as { banned?: boolean })?.banned
      ) {
        const data = e.data as unknown as { bannedReason?: string | null }
        set({
          loading: false,
          error: false,
          hydrated: true,
          banned: true,
          bannedReason: data?.bannedReason ?? null,
          maintenance: false,
          maintenanceReason: null,
          maintenanceCanBypass: false,
        })
        try {
          if (data?.bannedReason)
            sessionStorage.setItem("sh_banned_reason", data.bannedReason)
          else sessionStorage.removeItem("sh_banned_reason")
        } catch {}
        return
      }
      if (
        e instanceof ApiError &&
        e.status === 503 &&
        (e.data as unknown as { maintenance?: boolean })?.maintenance
      ) {
        const data = e.data as unknown as {
          maintenanceReason?: string | null
          canBypass?: boolean
        }
        set({
          loading: false,
          error: false,
          hydrated: true,
          maintenance: true,
          maintenanceReason: data?.maintenanceReason ?? null,
          maintenanceCanBypass: Boolean(data?.canBypass),
          banned: false,
          bannedReason: null,
        })
        return
      }
      set({ loading: false, error: true, hydrated: true })
    }
  },

  setSemester: async (code: string) => {
    set({ termCode: code })
    try {
      await apiClient.patch("/me/profile", { currentSemesterCode: code })
    } finally {
      await get().refresh()
    }
  },

  setPassed: (names: string[]) => {
    const { failed, profile } = get()
    const uni = profile?.universitySlug
    const major = profile?.majorSlug
    if (!uni || !major) return
    // If a course is marked passed, it cannot remain failed — remove it reactively.
    const passedSet = new Set(names)
    const nextFailed = failed.filter((f) => !passedSet.has(f.courseName))
    const failedRemoved = failed.length !== nextFailed.length
    set({
      passed: names.map((courseName) => ({
        id: `opt-${courseName}`,
        courseName,
        universitySlug: uni,
        majorSlug: major,
        year: null,
        semester: null,
        createdAt: new Date().toISOString(),
      })),
      ...(failedRemoved ? { failed: nextFailed } : {}),
    })
    replacePassedCourses(
      names.map((courseName) => ({
        universitySlug: uni,
        majorSlug: major,
        courseName,
      }))
    ).catch(() => {
      toastManager.add({
        type: "error",
        title: "خطا در ذخیره دروس پاس شده",
        data: { variant: "x" },
      })
    })
    // Sync failed removal to the server (fire-and-forget, server also enforces it).
    if (failedRemoved) {
      replaceFailedCourses(
        nextFailed.map((f) => ({
          universitySlug: uni,
          majorSlug: major,
          courseName: f.courseName,
        }))
      ).catch(() => {
        toastManager.add({
          type: "error",
          title: "خطا در به‌روزرسانی دروس مردود",
          data: { variant: "x" },
        })
      })
    }
  },

  setFailed: (names: string[]) => {
    const { passed, profile } = get()
    const uni = profile?.universitySlug
    const major = profile?.majorSlug
    if (!uni || !major) return
    // Keep passed/failed mutually exclusive — a failed course cannot also be passed.
    const failedSet = new Set(names)
    const nextPassed = passed.filter((p) => !failedSet.has(p.courseName))
    const passedRemoved = passed.length !== nextPassed.length
    set({
      failed: names.map((courseName) => ({
        id: `opt-${courseName}`,
        courseName,
        universitySlug: uni,
        majorSlug: major,
        year: null,
        semester: null,
        createdAt: new Date().toISOString(),
      })),
      ...(passedRemoved ? { passed: nextPassed } : {}),
    })
    replaceFailedCourses(
      names.map((courseName) => ({
        universitySlug: uni,
        majorSlug: major,
        courseName,
      }))
    ).catch(() => {
      toastManager.add({
        type: "error",
        title: "خطا در ذخیره دروس مردود",
        data: { variant: "x" },
      })
    })
    if (passedRemoved) {
      replacePassedCourses(
        nextPassed.map((p) => ({
          universitySlug: uni,
          majorSlug: major,
          courseName: p.courseName,
        }))
      ).catch(() => {
        toastManager.add({
          type: "error",
          title: "خطا در به‌روزرسانی دروس پاس شده",
          data: { variant: "x" },
        })
      })
    }
  },

  toggleNote: (courseIndex: string) => {
    const { noted, profile, termCode } = get()
    const uni = profile?.universitySlug
    const major = profile?.majorSlug
    if (!uni || !major || !termCode) return
    const parsed = parseTermCode(termCode)
    const year = parsed?.year != null ? String(parsed.year) : undefined
    const semester = parsed?.semester
    const isNoted = noted.some(
      (n) =>
        n.courseIndex === courseIndex &&
        n.year === (year ?? null) &&
        n.semester === (semester ?? null) &&
        !n.isDeleted
    )
    const note: MeNoted = {
      id: `opt-${courseIndex}`,
      universitySlug: uni,
      majorSlug: major,
      courseIndex,
      year: year ?? null,
      semester: semester ?? null,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set({
      noted: isNoted
        ? noted.filter(
            (n) =>
              !(
                n.courseIndex === courseIndex &&
                n.year === (year ?? null) &&
                n.semester === (semester ?? null)
              )
          )
        : [...noted, note],
    })
    if (isNoted)
      removeNoted(courseIndex, termCode).catch(() => {
        toastManager.add({
          type: "error",
          title: "خطا در حذف",
          data: { variant: "x" },
        })
      })
    else
      addNoted({
        universitySlug: uni,
        majorSlug: major,
        courseIndex,
        year,
        semester,
      }).catch(() => {
        toastManager.add({
          type: "error",
          title: "خطا در افزودن",
          data: { variant: "x" },
        })
      })
  },

  togglePassed: (courseName: string) => {
    const { passed, failed, profile } = get()
    const uni = profile?.universitySlug
    const major = profile?.majorSlug
    if (!uni || !major) return
    const isPassed = passed.some((p) => p.courseName === courseName)
    const next = isPassed
      ? passed.filter((p) => p.courseName !== courseName)
      : [
          ...passed,
          {
            id: `opt-${courseName}`,
            courseName,
            universitySlug: uni,
            majorSlug: major,
            year: null,
            semester: null,
            createdAt: new Date().toISOString(),
          } as MePassed,
        ]
    // Reactively remove from failed when marking as passed.
    const nextFailed =
      !isPassed && failed.some((f) => f.courseName === courseName)
        ? failed.filter((f) => f.courseName !== courseName)
        : failed
    const failedChanged = nextFailed.length !== failed.length
    set({ passed: next, ...(failedChanged ? { failed: nextFailed } : {}) })
    if (isPassed)
      removePassedCourse(courseName).catch(() => {
        toastManager.add({
          type: "error",
          title: "خطا در حذف درس پاس شده",
          data: { variant: "x" },
        })
      })
    else {
      replacePassedCourses(
        next.map((p) => ({
          universitySlug: uni,
          majorSlug: major,
          courseName: p.courseName,
        }))
      ).catch(() => {
        toastManager.add({
          type: "error",
          title: "خطا در ذخیره دروس پاس شده",
          data: { variant: "x" },
        })
      })
      if (failedChanged) {
        // Also persist failed removal server-side.
        removeFailedCourse(courseName).catch(() => {
          // Fallback: bulk replace remaining failed.
          replaceFailedCourses(
            nextFailed.map((f) => ({
              universitySlug: uni,
              majorSlug: major,
              courseName: f.courseName,
            }))
          ).catch(() => {
            toastManager.add({
              type: "error",
              title: "خطا در به‌روزرسانی دروس مردود",
              data: { variant: "x" },
            })
          })
        })
      }
    }
  },

  toggleFailed: (courseName: string) => {
    const { failed, passed, profile } = get()
    const uni = profile?.universitySlug
    const major = profile?.majorSlug
    if (!uni || !major) return
    const isFailed = failed.some((f) => f.courseName === courseName)
    const next = isFailed
      ? failed.filter((f) => f.courseName !== courseName)
      : [
          ...failed,
          {
            id: `opt-${courseName}`,
            courseName,
            universitySlug: uni,
            majorSlug: major,
            year: null,
            semester: null,
            createdAt: new Date().toISOString(),
          } as MeFailed,
        ]
    // Keep passed/failed exclusive — if marking failed, remove from passed.
    const nextPassed =
      !isFailed && passed.some((p) => p.courseName === courseName)
        ? passed.filter((p) => p.courseName !== courseName)
        : passed
    const passedChanged = nextPassed.length !== passed.length
    set({ failed: next, ...(passedChanged ? { passed: nextPassed } : {}) })
    if (isFailed)
      removeFailedCourse(courseName).catch(() => {
        toastManager.add({
          type: "error",
          title: "خطا در حذف درس مردود",
          data: { variant: "x" },
        })
      })
    else {
      replaceFailedCourses(
        next.map((f) => ({
          universitySlug: uni,
          majorSlug: major,
          courseName: f.courseName,
        }))
      ).catch(() => {
        toastManager.add({
          type: "error",
          title: "خطا در ذخیره دروس مردود",
          data: { variant: "x" },
        })
      })
      if (passedChanged) {
        removePassedCourse(courseName).catch(() => {
          replacePassedCourses(
            nextPassed.map((p) => ({
              universitySlug: uni,
              majorSlug: major,
              courseName: p.courseName,
            }))
          ).catch(() => {
            toastManager.add({
              type: "error",
              title: "خطا در به‌روزرسانی دروس پاس شده",
              data: { variant: "x" },
            })
          })
        })
      }
    }
  },

  clearNoted: () => {
    const { noted, termCode } = get()
    const parsed = termCode ? parseTermCode(termCode) : null
    const year = parsed?.year != null ? String(parsed.year) : null
    const semester = parsed?.semester ?? null
    // term-specific clear — only remove notes for current نیمسال
    const toRemove = noted.filter(
      (n) => n.year === year && n.semester === semester && !n.isDeleted
    )
    set({
      noted: noted.filter(
        (n) => !(n.year === year && n.semester === semester && !n.isDeleted)
      ),
    })
    for (const n of toRemove)
      removeNoted(n.courseIndex, termCode ?? undefined).catch(() => {
        toastManager.add({
          type: "error",
          title: "خطا در حذف یادداشت",
          data: { variant: "x" },
        })
      })
  },
}))

/** Convenience selectors used by widgets. */
export function useProfilePassedNames() {
  return useProfileStore((s) => new Set(s.passed.map((p) => p.courseName)))
}
export function useProfileFailedNames() {
  return useProfileStore((s) => new Set(s.failed.map((f) => f.courseName)))
}
export function useProfileNotedIndexes() {
  return useProfileStore((s) => {
    const termCode = s.termCode
    const parsed = termCode ? parseTermCode(termCode) : null
    const year = parsed?.year != null ? String(parsed.year) : null
    const semester = parsed?.semester ?? null
    return new Set(
      s.noted
        .filter(
          (n) => !n.isDeleted && n.year === year && n.semester === semester
        )
        .map((n) => n.courseIndex)
    )
  })
}
