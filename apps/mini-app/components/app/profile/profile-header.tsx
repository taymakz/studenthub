"use client"

import { useProfileStore } from "@/stores/profile-store"
import { WeeklySchedule } from "./weekly-schedule"
import { ExamSchedule } from "./exam-schedule"
import { MySchedule } from "./my-schedule"
import { FriendsButton } from "./friends-button"
import { GradeCalculator } from "./grade-calculator"
import { ProfileIdentity } from "./profile-identity"

/**
 * Profile header = old home header. Gender-tinted gradient ring around the
 * avatar, name + contributor badge, and the three circular tool buttons. Reads
 * the app-wide profile store (hydrated from /me/bootstrap).
 */
export function ProfileHeader() {
  const user = useProfileStore((s) => s.user)
  const profile = useProfileStore((s) => s.profile)
  const hydrated = useProfileStore((s) => s.hydrated)
  const gender = profile?.gender ?? null

  return (
    <header className="bg-secondary/50 safe-top-padding pb-6 dark:bg-card">
      <div className="container pt-4 pb-8">
        <ProfileIdentity user={user} gender={gender} hydrated={hydrated} />

        {/* Tools */}
        <div className="mx-auto grid max-w-80 grid-cols-3 items-center gap-4">
          <MySchedule />
          <FriendsButton />
          <GradeCalculator />
        </div>
        {/* Schedule drawers stay mounted — opened via events from برنامه من */}
        <WeeklySchedule hideTrigger />
        <ExamSchedule hideTrigger />
      </div>
    </header>
  )
}
