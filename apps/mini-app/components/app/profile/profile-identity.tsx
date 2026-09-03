import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import type { MeUser } from "@/lib/api"
import { proxyImage } from "@/lib/image-proxy"
import { CrownStarIcon } from "./tool-icons"

/**
 * Shared profile identity block (avatar + name) — same look as /profile.
 * Used by ProfileHeader and the friends page header.
 */
export function ProfileIdentity({
  user,
  gender,
  hydrated,
}: {
  user: MeUser | null
  gender: "MALE" | "FEMALE" | null
  hydrated: boolean
}) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ")

  return (
    <>
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
    </>
  )
}
