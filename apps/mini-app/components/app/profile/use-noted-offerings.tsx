"use client"

import { useProfileStore } from "@/stores/profile-store"

/**
 * The offering rows the student has pinned (noted), resolved against the
 * current semester's offer list. Drives the weekly-schedule / exam-schedule
 * tool drawers. Reads the app-wide profile store (hydrated from /me/bootstrap).
 */
export function useNotedOfferings() {
  const noted = useProfileStore((s) => s.noted)
  const offerings = useProfileStore((s) => s.offerings)
  const profile = useProfileStore((s) => s.profile)
  const hydrated = useProfileStore((s) => s.hydrated)
  const loading = useProfileStore((s) => s.loading)

  const enabled = Boolean(
    profile?.universitySlug &&
    profile?.majorSlug &&
    profile?.currentSemesterCode
  )

  const activeIndexes = new Set(noted.filter((n) => !n.isDeleted).map((n) => n.courseIndex))
  const notedOfferings = offerings.filter((o) => activeIndexes.has(o.index))

  return {
    notedOfferings,
    isLoading: !hydrated || loading,
    enabled,
  }
}

export function OfferingsEmpty({
  enabled,
  isLoading,
}: {
  enabled: boolean
  isLoading: boolean
}) {
  if (isLoading)
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        در حال بارگذاری…
      </p>
    )
  if (!enabled)
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        ابتدا پروفایل دانشگاهی خود را کامل کنید
      </p>
    )
  return (
    <p className="p-6 text-center text-sm text-muted-foreground">
      درسی برای نمایش نیست
    </p>
  )
}

export function OfferingRow({
  offering,
}: {
  offering: import("@/lib/api").Offering
}) {
  const prof =
    (typeof offering.professor === "string"
      ? offering.professor
      : (offering.professor as { fa?: string } | null)?.fa) ?? null
  return (
    <div className="space-y-1 rounded-lg border bg-card p-3">
      <p className="line-clamp-2 text-sm font-medium">{offering.courseName}</p>
      <p className="text-xs text-muted-foreground">{offering.courseCode}</p>
      {prof && <p className="text-xs text-muted-foreground">استاد: {prof}</p>}
      {offering.location && (
        <p className="text-xs text-muted-foreground">
          محل: {offering.location}
        </p>
      )}
    </div>
  )
}
