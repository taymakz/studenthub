"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, UserPlus } from "lucide-react"
import { AnimatePresence, m } from "motion/react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { CopyStateIcon } from "@workspace/ui/components/copy-button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard"

import ContentLayout from "@/components/app/content-layout"
import { useProfileStore } from "@/stores/profile-store"
import { AddFriendDrawer } from "@/components/app/friends/add-friend-drawer"
import { FriendsTab, PendingTab } from "@/components/app/friends/friends-lists"
import { FriendsSettings } from "@/components/app/friends/friends-settings"
import { useFriendsSummary } from "@/components/app/friends/use-friends-data"
import { ProfileIdentity } from "@/components/app/profile/profile-identity"

type FriendsTabKey = "friends" | "pending" | "settings"

/** 3-digit comma separator for the friend id (5725800953 -> 5,725,800,953). */
function formatFriendId(id: number): string {
  return id.toLocaleString("en-US")
}

/**
 * Profile-like header (just like /profile): avatar + name, with the friend
 * ID below it. The whole ID pill copies on tap; the icon morphs to a check.
 */
function FriendsHeader({ onBack }: { onBack: () => void }) {
  const user = useProfileStore((s) => s.user)
  const profile = useProfileStore((s) => s.profile)
  const hydrated = useProfileStore((s) => s.hydrated)
  const gender = profile?.gender ?? null
  const { copyToClipboard, isCopied } = useCopyToClipboard()

  const copy = () => {
    if (!user) return
    copyToClipboard(String(user.id))
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

        <ProfileIdentity user={user} gender={gender} hydrated={hydrated} />

        {/* Friend ID below the profile */}
        {!hydrated || !user ? (
          <Skeleton className="mx-auto h-10 w-52 rounded-full" />
        ) : (
          <button
            type="button"
            onClick={copy}
            aria-label="کپی شناسه دوستی"
            dir="ltr"
            className="mx-auto flex w-fit cursor-pointer items-center gap-2 rounded-full border bg-card px-4 py-1.5 transition-transform active:scale-95"
          >
            <span className="font-mono text-lg font-semibold tracking-wider">
              {formatFriendId(user.id)}
            </span>
            <CopyStateIcon copied={isCopied} />
          </button>
        )}
      </div>
    </header>
  )
}

export default function FriendsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<FriendsTabKey>("friends")
  const [addOpen, setAddOpen] = useState(false)
  const summary = useFriendsSummary(true)
  const { refetch } = summary

  // Counts refresh every time the page opens.
  useEffect(() => {
    void refetch()
  }, [refetch])

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
                <span className="flex items-center gap-1.5">
                  دوستان
                  {friendsCount > 0 && <Badge>{friendsCount}</Badge>}
                </span>
              </TabsTrigger>
              <TabsTrigger value="pending">
                <span className="flex items-center gap-1.5">
                  در انتظار
                  {incoming > 0 && <Badge>{incoming}</Badge>}
                </span>
              </TabsTrigger>
              <TabsTrigger value="settings">تنظیمات</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="min-h-30">
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.1 }}
              >
                {tab === "friends" ? (
                  <FriendsTab />
                ) : tab === "pending" ? (
                  <PendingTab />
                ) : (
                  <FriendsSettings />
                )}
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      </ContentLayout>
    </div>
  )
}
