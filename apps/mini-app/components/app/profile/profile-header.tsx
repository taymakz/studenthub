"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { useProfileStore } from "@/stores/profile-store"
import { proxyImage } from "@/lib/image-proxy"
import { CrownStarIcon } from "./tool-icons"
import { WeeklySchedule } from "./weekly-schedule"
import { ExamSchedule } from "./exam-schedule"
import { GradeCalculator } from "./grade-calculator"

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

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ")

  return (
    <header className="bg-secondary/50 safe-top-padding pb-6 dark:bg-card">
      <div className="container pt-4 pb-8">
        {/* Avatar with gender gradient ring */}
        <div className="relative mx-auto mb-4 size-fit overflow-hidden rounded-full p-0.75">
          <div
            className={cn(
              "animated-gradient-bg absolute inset-0 rounded-full",
              gender === "MALE" ? "gradient-male" : "gradient-female"
            )}
          />
          <div className="relative z-10 size-22 overflow-hidden rounded-full">
            {!hydrated ? (
              <Skeleton className="size-full rounded-full bg-muted" />
            ) : (
              <Avatar className="size-full rounded-full">
                <AvatarImage
                  src={proxyImage(user?.photoUrl) ?? ""}
                  alt={fullName || "پروفایل"}
                />
                <AvatarFallback className="bg-muted text-lg">
                  {fullName.slice(0, 2) || "پ"}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>

        {/* Name + contributor crown */}
        <div className="mb-4 flex items-center justify-center gap-1.5">
          {user?.isContributor && (
            <CrownStarIcon className="size-5 text-destructive" />
          )}
          <div className="line-clamp-1 h-5 font-medium">
            {!hydrated ? (
              <Skeleton className="mx-auto h-5 w-28" />
            ) : (
              fullName || "دانشجو"
            )}
          </div>
        </div>

        {/* Tools */}
        <div className="mx-auto grid max-w-80 grid-cols-3 items-center gap-4">
          <WeeklySchedule />
          <ExamSchedule />
          <GradeCalculator />
        </div>
      </div>
    </header>
  )
}
