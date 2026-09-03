"use client"

import { useState } from "react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

import type { Offering } from "@/lib/api"
import {
  FriendsEmpty,
  FriendsError,
  FriendsLoading,
  LoadMoreButton,
  PersonRow,
} from "./friend-rows"
import { userSubtitle } from "./friends-text"
import { useCourseMates } from "./use-friends-data"
import { FriendDetailDrawer } from "./friend-detail-drawer"

/**
 * Full list of friends who noted one course (opened by tapping its faces).
 * Tapping a row opens that friend's detail drawer.
 */
export function CourseMatesDrawer({
  offering,
  uni,
  major,
  termCode,
  open,
  onOpenChange,
}: {
  offering: Offering | null
  uni: string | null | undefined
  major: string | null | undefined
  termCode: string | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [friendId, setFriendId] = useState<number | null>(null)
  const list = useCourseMates(
    offering?.index ?? null,
    uni,
    major,
    termCode,
    open
  )
  const mates = list.data?.pages.flatMap((p) => p.mates) ?? []

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader>
            <DrawerTitle>{offering?.courseName ?? "هم‌درسی‌ها"}</DrawerTitle>
            <DrawerDescription>
              دوست‌هایی که این درس را برداشته‌اند
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="p-4">
            {list.isLoading ? (
              <FriendsLoading />
            ) : list.isError ? (
              <FriendsError
                message={(list.error as Error)?.message ?? "خطا در دریافت لیست"}
              />
            ) : mates.length === 0 ? (
              <FriendsEmpty message="هنوز دوستی این درس را برنداشته است." />
            ) : (
              <div className="space-y-2">
                {mates.map((u) => (
                  <PersonRow
                    key={u.id}
                    user={u}
                    subtitle={userSubtitle(u)}
                    subtitleLtr
                    onClick={() => setFriendId(u.id)}
                  />
                ))}
                {list.hasNextPage && (
                  <LoadMoreButton
                    isFetching={list.isFetchingNextPage}
                    onLoadMore={() => void list.fetchNextPage()}
                  />
                )}
              </div>
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      <FriendDetailDrawer
        friendId={friendId}
        open={friendId !== null}
        onOpenChange={(o) => !o && setFriendId(null)}
      />
    </>
  )
}
