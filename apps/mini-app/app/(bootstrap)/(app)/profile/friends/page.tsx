"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, UserPlus } from "lucide-react"

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

import ContentLayout from "@/components/app/content-layout"
import { useProfileStore } from "@/stores/profile-store"
import { AddFriendDrawer } from "@/components/app/friends/add-friend-drawer"
import { FriendsTab, PendingTab } from "@/components/app/friends/friends-lists"
import { FriendsSettings } from "@/components/app/friends/friends-settings"
import { useFriendsSummary } from "@/components/app/friends/use-friends-data"

type FriendsTabKey = "pending" | "friends" | "settings"

/** Own friend-id card — tap the id or the copy button to copy it. */
function FriendIdCard() {
  const user = useProfileStore((s) => s.user)
  const hydrated = useProfileStore((s) => s.hydrated)
  const { copyToClipboard } = useCopyToClipboard()

  if (!hydrated || !user) return <Skeleton className="h-32 rounded-xl" />

  const id = String(user.id)
  const copy = () => {
    copyToClipboard(id)
    toastManager.add({
      type: "success",
      title: "کپی شد!",
      data: { variant: "x" },
    })
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">شناسه دوستی شما</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          dir="ltr"
          onClick={copy}
          aria-label="کپی شناسه دوستی"
          className="font-mono text-2xl font-semibold tracking-wider transition-transform active:scale-95"
        >
          {id}
        </button>
        <CopyButton text={id} label="کپی شناسه" />
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        این شناسه را به دوستانت بده تا بتوانند برایت درخواست دوستی بفرستند.
      </p>
    </div>
  )
}

export default function FriendsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<FriendsTabKey>("pending")
  const [addOpen, setAddOpen] = useState(false)
  const summary = useFriendsSummary(true)

  const incoming = summary.data?.incomingPendingCount ?? 0
  const friendsCount = summary.data?.friendsCount ?? 0

  return (
    <div className="safe-top-padding pb-8">
      <div className="container flex items-center gap-1 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="بازگشت"
          onClick={() => router.back()}
        >
          <ChevronRight className="size-5" />
        </Button>
        <h1 className="text-base font-semibold">دوستای من</h1>
      </div>

      <ContentLayout>
        <div className="container mx-auto max-w-screen-sm space-y-4 px-4">
          <FriendIdCard />

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
              <TabsTrigger value="pending">
                در انتظار{incoming > 0 ? ` ${incoming}` : ""}
              </TabsTrigger>
              <TabsTrigger value="friends">
                دوستان{friendsCount > 0 ? ` ${friendsCount}` : ""}
              </TabsTrigger>
              <TabsTrigger value="settings">تنظیمات</TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="pt-3">
              <PendingTab />
            </TabsContent>
            <TabsContent value="friends" className="pt-3">
              <FriendsTab />
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
