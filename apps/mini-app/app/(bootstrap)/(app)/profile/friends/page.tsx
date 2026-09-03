"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, UserPlus } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { CopyButton } from "@workspace/ui/components/copy-button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toastManager } from "@workspace/ui/components/toast"
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard"
import { cn } from "@workspace/ui/lib/utils"

import ContentLayout from "@/components/app/content-layout"
import { proxyImage } from "@/lib/image-proxy"
import { useProfileStore } from "@/stores/profile-store"
import { CrownStarIcon } from "@/components/app/profile/tool-icons"
import { AddFriendDrawer } from "@/components/app/friends/add-friend-drawer"
import { FriendsTab, PendingTab } from "@/components/app/friends/friends-lists"
import { FriendsSettings } from "@/components/app/friends/friends-settings"
import { useFriendsSummary } from "@/components/app/friends/use-friends-data"

type FriendsTabKey = "friends" | "pending" | "settings"

/**
 * Profile-like header (just like /profile): avatar + name, with the friend
 * ID + copy below it. Tapping the id or the copy button copies it.
 */
function FriendsHeader({ onBack }: { onBack: () => void }) {
  const user = useProfileStore((s) => s.user)
  const profile = useProfileStore((s) => s.profile)
  const hydrated = useProfileStore((s) => s.hydrated)
  const gender = profile?.gender ?? null
  const { copyToClipboard } = useCopyToClipboard()

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ")

  const copy = () => {
    if (!user) return
    copyToClipboard(String(user.id))
    toastManager.add({
      type: "success",
      title: "کپی شد!",
      data: { variant: "x" },
    })
  }

  return (
    <header className="bg-secondary/50 safe-top-padding pb-6 dark:bg-card">
      <div className="container pt-4 pb-8">
        <div className="mb-2 flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="بازگشت"
            onClick={onBack}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        {/* Avatar with gender gradient ring (same as /profile) */}
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

        {/* Name + contributor crown (same as /profile) */}
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

        {/* Friend ID below the profile */}
        {!hydrated || !user ? (
          <Skeleton className="mx-auto h-10 w-44 rounded-full" />
        ) : (
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border bg-card px-4 py-1.5" dir="ltr">
            <button
              type="button"
              onClick={copy}
              aria-label="کپی شناسه دوستی"
              className="font-mono text-lg font-semibold tracking-wider transition-transform active:scale-95"
            >
              {user.id}
            </button>
            <CopyButton
              text={String(user.id)}
              label="کپی شناسه"
              size="icon-xs"
            />
          </div>
        )}
        <p className="mt-2 text-center text-xs opacity-80">
          این شناسه را به دوستانت بده تا درخواست دوستی بفرستند
        </p>
      </div>
    </header>
  )
}

export default function FriendsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<FriendsTabKey>("friends")
  const [addOpen, setAddOpen] = useState(false)
  const summary = useFriendsSummary(true)

  const incoming = summary.data?.incomingPendingCount ?? 0
  const friendsCount = summary.data?.friendsCount ?? 0

  return (
    <div className="pb-8">
      <FriendsHeader onBack={() => router.back()} />

      <ContentLayout>
        <div className="container mx-auto max-w-screen-sm space-y-4 px-4">
          <Button
            type="button"
            className="w-full"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="size-4" />
            افزودن دوست با شناسه
          </Button>
          <AddFriendDrawer open={addOpen} onOpenChange={setAddOpen} />

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as FriendsTabKey)}
            variant="line"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="friends">
                دوستان{friendsCount > 0 ? ` ${friendsCount}` : ""}
              </TabsTrigger>
              <TabsTrigger value="pending">
                در انتظار{incoming > 0 ? ` ${incoming}` : ""}
              </TabsTrigger>
              <TabsTrigger value="settings">تنظیمات</TabsTrigger>
            </TabsList>
            <TabsContent value="friends" className="pt-3">
              <FriendsTab />
            </TabsContent>
            <TabsContent value="pending" className="pt-3">
              <PendingTab />
            </TabsContent>
            <TabsContent value="settings" className="pt-3">
              <FriendsSettings />
            </TabsContent>
          </Tabs>
        </div>
      </ContentLayout>
    </div>
  )
}
