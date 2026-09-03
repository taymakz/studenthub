"use client"

import { useState } from "react"
import { Virtuoso } from "react-virtuoso"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { Spinner } from "@workspace/ui/components/spinner"

import { ConfirmDrawer } from "./confirm-drawer"
import {
  FriendsEmpty,
  FriendsError,
  FriendsLoading,
  PersonRow,
  UnblockAction,
} from "./friend-rows"
import { useBlockList, useUnblockUser } from "./use-friends-data"

/**
 * Block list drawer (opened from the friends settings tab): infinite blocked
 * users list, each with an unblock button behind an inset confirm drawer.
 */
export function BlockListDrawer({
  trigger,
}: {
  trigger: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const list = useBlockList(open)
  const unblock = useUnblockUser()

  const items = list.data?.pages.flatMap((p) => p.blocked) ?? []

  const handleLoadMore = () => {
    if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage()
  }

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger render={trigger} />
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader>
            <DrawerTitle>لیست مسدودشده‌ها</DrawerTitle>
            <DrawerDescription>
              این کاربران نمی‌توانند به شما درخواست دوستی بدهند
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="p-4" viewportRef={setScrollParent}>
            {list.isLoading ? (
              <FriendsLoading />
            ) : list.isError ? (
              <FriendsError
                message={
                  (list.error as Error)?.message ?? "خطا در دریافت لیست"
                }
              />
            ) : items.length === 0 ? (
              <FriendsEmpty message="هیچ کاربری را مسدود نکرده‌اید." />
            ) : (
              <div>
                {scrollParent ? (
                  <Virtuoso
                    customScrollParent={scrollParent}
                    data={items}
                    overscan={6}
                    endReached={handleLoadMore}
                    itemContent={(_, b) => (
                      <div className="pb-2">
                        <PersonRow user={b.user}>
                          <UnblockAction onClick={() => setConfirmId(b.user.id)} />
                        </PersonRow>
                      </div>
                    )}
                  />
                ) : null}
                {list.isFetchingNextPage && (
                  <div className="flex justify-center py-2">
                    <Spinner />
                  </div>
                )}
              </div>
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      <ConfirmDrawer
        open={confirmId !== null}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="رفع مسدودیت"
        description="این کاربر دوباره می‌تواند به شما درخواست دوستی بدهد."
        confirmLabel="رفع مسدودیت"
        pending={unblock.isPending}
        onConfirm={() => {
          if (confirmId !== null) {
            unblock.mutate(confirmId, {
              onSuccess: () => setConfirmId(null),
            })
          }
        }}
      />
    </>
  )
}
